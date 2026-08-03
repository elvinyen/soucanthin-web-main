import { createHmac, randomBytes } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';
import type { OrderStatus } from '../types/order';
import type { AuthUser, UserAddress, UserCoupon, UserOrderSummary, WalletSummary, WalletTransaction } from '../types/auth';

const SESSION_COOKIE = 'sct_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MAX_ACTIVE_SESSIONS_PER_USER = 5;
const OTP_VALIDITY_SECONDS = 5 * 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_PHONE_HOURLY_LIMIT = 5;
const OTP_PHONE_DAILY_LIMIT = 15;
const OTP_CLIENT_HOURLY_LIMIT = 20;
const OTP_CLIENT_DAILY_LIMIT = 100;

export type OtpPurpose = 'login' | 'update_phone';

type OtpChallengeRecord = {
  id: string;
  user_id?: string | null;
  phone: string;
  display_phone: string;
  provider_reqid: string;
  purpose: OtpPurpose;
  request_fingerprint: string;
  attempt_count: number;
  expires_at: string;
  consumed_at?: string | null;
  created_at: string;
};

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

export type UserRecord = {
  id: string;
  phone: string;
  display_phone: string;
  name?: string | null;
  email?: string | null;
  birthday?: string | null;
  source?: 'otp' | 'admin_created';
  created_by_admin_id?: string | null;
  created_at: string;
  last_login_at?: string | null;
};

export type WalletRecord = {
  id: string;
  user_id: string;
  balance: number;
  currency: 'MYR';
};

export type WalletTransactionRecord = {
  id: string;
  user_id: string;
  type: WalletTransaction['type'];
  method: WalletTransaction['method'];
  amount: number;
  status: WalletTransaction['status'];
  note?: string | null;
  receipt_url?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  review_token?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export function parseJsonBody<T>(body: unknown): T {
  if (!body) throw new Error('Request body is required');
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as T;
  if (typeof body === 'string') return JSON.parse(body) as T;
  return body as T;
}

export function normalizeMalaysiaPhone(value: string) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  let normalized = digits;

  if (/^(60|65|66|84|86)/.test(digits)) {
    normalized = digits;
  } else if (digits.startsWith('0')) {
    normalized = `60${digits.slice(1)}`;
  } else if (digits.startsWith('1')) {
    normalized = `60${digits}`;
  }

  const isSupportedPhone =
    /^60\d{8,11}$/.test(normalized) ||
    /^65\d{8}$/.test(normalized) ||
    /^66\d{8,10}$/.test(normalized) ||
    /^84\d{8,10}$/.test(normalized) ||
    /^86\d{11}$/.test(normalized);

  if (!isSupportedPhone) {
    throw new Error('请输入有效的手机号');
  }

  return {
    phone: normalized,
    displayPhone: `+${normalized}`,
  };
}

export async function requestMoceanOtp(phone: string) {
  const apiToken = process.env.MOCEAN_API_TOKEN;
  const brand = process.env.MOCEAN_BRAND || 'SoupCanThin';

  if (!apiToken) throw new Error('Mocean is not configured');

  const body = new URLSearchParams();
  body.set('mocean-to', phone);
  body.set('mocean-brand', brand);
  body.set('mocean-code-length', '6');
  body.set('mocean-pin-validity', '300');
  body.set('mocean-resp-format', 'json');

  if (process.env.MOCEAN_SENDER_ID) {
    body.set('mocean-from', process.env.MOCEAN_SENDER_ID);
  }

  const payload = await moceanRequest('https://rest.moceanapi.com/rest/2/verify/req/sms', body, apiToken);
  if (Number(payload.status) !== 0 || !payload.reqid) {
    throw new Error(payload.err_msg || '验证码发送失败');
  }

  return String(payload.reqid);
}

export async function verifyMoceanOtp(reqid: string, code: string) {
  const apiToken = process.env.MOCEAN_API_TOKEN;
  if (!apiToken) throw new Error('Mocean is not configured');

  const body = new URLSearchParams();
  body.set('mocean-reqid', reqid);
  body.set('mocean-code', code);
  body.set('mocean-resp-format', 'json');

  const payload = await moceanRequest('https://rest.moceanapi.com/rest/2/verify/check', body, apiToken);
  if (Number(payload.status) !== 0) {
    throw new Error(payload.err_msg || '验证码不正确或已过期');
  }
}

export async function createOtpChallenge(
  req: ApiRequest,
  phone: string,
  displayPhone: string,
  purpose: OtpPurpose,
  userId: string | null = null,
) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60_000).toISOString();
  const oneHourAgo = new Date(now - 60 * 60_000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60_000).toISOString();
  const requestFingerprint = hashToken(readClientAddress(req), getSessionSecret());

  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/otp_challenges?created_at=lt.${encodeURIComponent(oneDayAgo)}`,
    { method: 'DELETE' },
  );

  const [recentPhone, hourlyPhone, dailyPhone, hourlyClient, dailyClient] = await Promise.all([
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/otp_challenges?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${encodeURIComponent(oneMinuteAgo)}&select=id&limit=1`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/otp_challenges?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/otp_challenges?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${encodeURIComponent(oneDayAgo)}&select=id`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/otp_challenges?request_fingerprint=eq.${encodeURIComponent(requestFingerprint)}&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/otp_challenges?request_fingerprint=eq.${encodeURIComponent(requestFingerprint)}&created_at=gte.${encodeURIComponent(oneDayAgo)}&select=id`,
      { method: 'GET' },
    ),
  ]);

  if (Array.isArray(recentPhone) && recentPhone.length > 0) {
    throw new AuthError('验证码发送过于频繁，请稍后再试', 429);
  }
  if (Array.isArray(hourlyPhone) && hourlyPhone.length >= OTP_PHONE_HOURLY_LIMIT) {
    throw new AuthError('该手机号请求验证码次数过多，请一小时后再试', 429);
  }
  if (Array.isArray(dailyPhone) && dailyPhone.length >= OTP_PHONE_DAILY_LIMIT) {
    throw new AuthError('该手机号今日请求验证码次数过多，请明天再试', 429);
  }
  if (Array.isArray(hourlyClient) && hourlyClient.length >= OTP_CLIENT_HOURLY_LIMIT) {
    throw new AuthError('验证码请求次数过多，请一小时后再试', 429);
  }
  if (Array.isArray(dailyClient) && dailyClient.length >= OTP_CLIENT_DAILY_LIMIT) {
    throw new AuthError('今日验证码请求次数过多，请明天再试', 429);
  }

  const providerReqid = await requestMoceanOtp(phone);
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/otp_challenges', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      phone,
      display_phone: displayPhone,
      provider_reqid: providerReqid,
      purpose,
      request_fingerprint: requestFingerprint,
      attempt_count: 0,
      expires_at: new Date(now + OTP_VALIDITY_SECONDS * 1000).toISOString(),
    }),
  });
  const challenge = Array.isArray(created) ? created[0] as OtpChallengeRecord | undefined : undefined;
  if (!challenge?.id) throw new Error('验证码请求未保存');

  return {
    challengeId: challenge.id,
    displayPhone,
    expiresIn: OTP_VALIDITY_SECONDS,
  };
}

export async function verifyOtpChallenge(params: {
  challengeId: string;
  code: string;
  purpose: OtpPurpose;
  userId?: string | null;
  expectedPhone?: string;
}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/otp_challenges?id=eq.${encodeURIComponent(params.challengeId)}&purpose=eq.${encodeURIComponent(params.purpose)}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=*`,
    { method: 'GET' },
  );
  const challenge = Array.isArray(rows) ? rows[0] as OtpChallengeRecord | undefined : undefined;

  if (!challenge) throw new AuthError('验证码请求不存在或已过期');
  if (challenge.attempt_count >= OTP_MAX_VERIFY_ATTEMPTS) {
    throw new AuthError('验证码尝试次数过多，请重新获取');
  }
  if (params.purpose === 'update_phone' && (!params.userId || challenge.user_id !== params.userId)) {
    throw new AuthError('验证码请求与当前账号不匹配');
  }
  if (params.expectedPhone && challenge.phone !== params.expectedPhone) {
    throw new AuthError('验证码与手机号码不匹配');
  }

  try {
    await verifyMoceanOtp(challenge.provider_reqid, params.code);
  } catch {
    const nextAttemptCount = challenge.attempt_count + 1;
    await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/otp_challenges?id=eq.${encodeURIComponent(challenge.id)}&consumed_at=is.null`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          attempt_count: nextAttemptCount,
          ...(nextAttemptCount >= OTP_MAX_VERIFY_ATTEMPTS ? { consumed_at: now } : {}),
        }),
      },
    );
    throw new AuthError(nextAttemptCount >= OTP_MAX_VERIFY_ATTEMPTS
      ? '验证码尝试次数过多，请重新获取'
      : '验证码不正确或已过期');
  }

  const consumed = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/otp_challenges?id=eq.${encodeURIComponent(challenge.id)}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(now)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ consumed_at: now }),
    },
  );
  const consumedChallenge = Array.isArray(consumed) ? consumed[0] as OtpChallengeRecord | undefined : undefined;
  if (!consumedChallenge?.id) throw new AuthError('验证码已经使用或已过期');

  return {
    phone: consumedChallenge.phone,
    displayPhone: consumedChallenge.display_phone,
  };
}

async function moceanRequest(url: string, body: URLSearchParams, apiToken: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.err_msg || `Mocean request failed with ${response.status}`);
  }

  return payload as { status?: number | string; reqid?: string; err_msg?: string };
}

export async function findOrCreateUser(phone: string, displayPhone: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/users?phone=eq.${encodeURIComponent(phone)}&select=*`,
    { method: 'GET' },
  );
  const now = new Date().toISOString();
  const current = Array.isArray(existing) ? existing[0] as UserRecord | undefined : undefined;

  if (current) {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/users?id=eq.${encodeURIComponent(current.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ display_phone: displayPhone, last_login_at: now }),
    });
    await ensureWallet(current.id);
    return { ...current, display_phone: displayPhone, last_login_at: now };
  }

  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      phone,
      display_phone: displayPhone,
      name: generateMemberName(),
      last_login_at: now,
    }),
  });
  const user = Array.isArray(created) ? created[0] as UserRecord : null;
  if (!user?.id) throw new Error('User was not saved');
  await ensureWallet(user.id);
  return user;
}

function generateMemberName() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const suffix = Array.from(randomBytes(8))
    .map(byte => alphabet[byte % alphabet.length])
    .join('');
  return `member_${suffix}`;
}

export async function createSession(userId: string) {
  const secret = getSessionSecret();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token, secret);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_sessions?expires_at=lte.${encodeURIComponent(new Date().toISOString())}`,
    { method: 'DELETE' },
  );

  await supabaseRequest(supabaseUrl, serviceRoleKey, '/user_sessions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    }),
  });

  const activeSessions = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_sessions?user_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.desc`,
    { method: 'GET' },
  );
  const staleSessionIds = (Array.isArray(activeSessions) ? activeSessions : [])
    .slice(MAX_ACTIVE_SESSIONS_PER_USER)
    .map((session: { id?: string }) => session.id)
    .filter((id): id is string => Boolean(id));
  if (staleSessionIds.length > 0) {
    await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/user_sessions?id=in.(${staleSessionIds.map(id => encodeURIComponent(id)).join(',')})`,
      { method: 'DELETE' },
    );
  }

  return token;
}

export async function destroySession(req: ApiRequest) {
  const token = readSessionToken(req);
  if (!token) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/user_sessions?token_hash=eq.${encodeURIComponent(hashToken(token, getSessionSecret()))}`, {
    method: 'DELETE',
  });
}

export async function getAuthenticatedUser(req: ApiRequest) {
  const token = readSessionToken(req);
  if (!token) return null;

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const sessions = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_sessions?token_hash=eq.${encodeURIComponent(hashToken(token, getSessionSecret()))}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`,
    { method: 'GET' },
  );
  const session = Array.isArray(sessions) ? sessions[0] as { user_id: string } | undefined : undefined;
  if (!session?.user_id) return null;

  const users = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/users?id=eq.${encodeURIComponent(session.user_id)}&select=*`,
    { method: 'GET' },
  );
  const user = Array.isArray(users) ? users[0] as UserRecord | undefined : undefined;
  return user || null;
}

export function setSessionCookie(res: ApiResponse, token: string) {
  res.setHeader?.('Set-Cookie', serializeCookie(SESSION_COOKIE, token, SESSION_MAX_AGE_SECONDS));
}

export function clearSessionCookie(res: ApiResponse) {
  res.setHeader?.('Set-Cookie', serializeCookie(SESSION_COOKIE, '', 0));
}

export async function ensureWallet(userId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/wallets?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, balance: 0, currency: 'MYR' }),
  });
}

export async function getWallet(userId: string): Promise<WalletSummary> {
  await ensureWallet(userId);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const wallets = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/wallets?user_id=eq.${encodeURIComponent(userId)}&select=*`,
    { method: 'GET' },
  );
  const wallet = Array.isArray(wallets) ? wallets[0] as WalletRecord | undefined : undefined;
  return { balance: roundMoney(Number(wallet?.balance || 0)), currency: 'MYR' };
}

export async function getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/wallet_transactions?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=30`,
    { method: 'GET' },
  );
  return (Array.isArray(rows) ? rows as WalletTransactionRecord[] : []).map(mapWalletTransaction);
}

export async function getUserOrders(userId: string): Promise<UserOrderSummary[]> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?user_id=eq.${encodeURIComponent(userId)}&select=id,order_no,order_type,payment_method,customer_name,customer_phone,table_no,delivery_address,note,subtotal,delivery_fee,service_charge,total,discount_amount,payable_total,status,payment_status,payment_review_status,created_at&order=created_at.desc&limit=20`,
    { method: 'GET' },
  );
  const orders = Array.isArray(rows) ? rows : [];
  const orderIds = orders.map((row: any) => row.id).filter(Boolean);
  const items = orderIds.length
    ? await supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        `/order_items?order_id=in.(${orderIds.map((id: string) => encodeURIComponent(id)).join(',')})&select=id,order_id,name,unit_price,quantity,line_total,selected_options,item_note&order=created_at.asc`,
        { method: 'GET' },
      )
    : [];
  const itemsByOrder = new Map<string, any[]>();
  (Array.isArray(items) ? items : []).forEach((item: any) => {
    const next = itemsByOrder.get(item.order_id) || [];
    next.push(item);
    itemsByOrder.set(item.order_id, next);
  });

  return orders.map((row: any) => ({
    id: row.id,
    orderNo: row.order_no,
    total: Number(row.total || 0),
    subtotal: Number(row.subtotal || 0),
    deliveryFee: Number(row.delivery_fee || 0),
    serviceCharge: Number(row.service_charge || 0),
    discountAmount: Number(row.discount_amount || 0),
    payableTotal: Number(row.payable_total ?? row.total ?? 0),
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    orderType: row.order_type,
    tableNo: row.table_no || null,
    deliveryAddress: row.delivery_address || null,
    note: row.note || null,
    items: (itemsByOrder.get(row.id) || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      price: Number(item.unit_price || 0),
      quantity: Number(item.quantity || 0),
      lineTotal: Number(item.line_total || 0),
      options: Array.isArray(item.selected_options) ? item.selected_options : [],
      note: item.item_note || null,
    })),
    createdAt: row.created_at,
  }));
}

export async function getUserAddresses(userId: string): Promise<UserAddress[]> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_addresses?user_id=eq.${encodeURIComponent(userId)}&select=*&order=is_default.desc,created_at.desc`,
    { method: 'GET' },
  );
  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    address: row.address,
    isDefault: Boolean(row.is_default),
  }));
}

export async function getUserCoupons(userId: string): Promise<UserCoupon[]> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?user_id=eq.${encodeURIComponent(userId)}&status=eq.reserved&reservation_expires_at=lt.${encodeURIComponent(now)}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'available', reserved_at: null, reservation_expires_at: null, reserved_order_id: null }) },
  );
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?user_id=eq.${encodeURIComponent(userId)}&select=id,status,expires_at,used_at,reservation_expires_at,coupons(code,title,description,discount_amount,discount_type,discount_value,min_order_amount,max_discount_amount,applicable_order_types,applicable_payment_methods,applicable_branch_ids,exclude_delivery_fee,status,valid_from,valid_until)&order=created_at.desc`,
    { method: 'GET' },
  );
  return (Array.isArray(rows) ? rows : []).map((row: any) => {
    const campaignUnavailable = row.coupons?.status !== 'active'
      || (row.coupons?.valid_from && new Date(row.coupons.valid_from).getTime() > Date.now())
      || (row.coupons?.valid_until && new Date(row.coupons.valid_until).getTime() <= Date.now());
    const expired = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    const reservationExpired = row.status === 'reserved' && row.reservation_expires_at && new Date(row.reservation_expires_at).getTime() <= Date.now();
    return {
      id: row.id,
      code: row.coupons?.code || '',
      title: row.coupons?.title || '优惠券',
      description: row.coupons?.description || null,
      discountAmount: Number(row.coupons?.discount_amount || row.coupons?.discount_value || 0),
      discountType: row.coupons?.discount_type === 'percentage' ? 'percentage' : 'fixed',
      discountValue: Number(row.coupons?.discount_value ?? row.coupons?.discount_amount ?? 0),
      minOrderAmount: Number(row.coupons?.min_order_amount || 0),
      maxDiscountAmount: row.coupons?.max_discount_amount == null ? null : Number(row.coupons.max_discount_amount),
      applicableOrderTypes: Array.isArray(row.coupons?.applicable_order_types) ? row.coupons.applicable_order_types : ['dinein', 'takeaway'],
      applicablePaymentMethods: Array.isArray(row.coupons?.applicable_payment_methods) ? row.coupons.applicable_payment_methods : ['cash', 'tng', 'stripe', 'wallet'],
      applicableBranchIds: Array.isArray(row.coupons?.applicable_branch_ids) ? row.coupons.applicable_branch_ids : [],
      excludeDeliveryFee: row.coupons?.exclude_delivery_fee !== false,
      status: expired || campaignUnavailable ? 'expired' : reservationExpired ? 'available' : row.status,
      expiresAt: row.expires_at,
      usedAt: row.used_at || null,
    } as UserCoupon;
  });
}

export function mapUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    displayPhone: user.display_phone,
    name: user.name || null,
    email: user.email || null,
    birthday: user.birthday || null,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at || null,
  };
}

export function mapWalletTransaction(row: WalletTransactionRecord): WalletTransaction {
  return {
    id: row.id,
    type: row.type,
    method: row.method,
    amount: Number(row.amount || 0),
    status: row.status,
    note: row.note || null,
    receiptUrl: row.receipt_url || null,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

function readSessionToken(req: ApiRequest) {
  const cookieHeader = req.headers?.cookie || req.headers?.Cookie;
  const cookieText = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader || '';
  const cookies = Object.fromEntries(cookieText.split(';').map(part => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }).filter(([key]) => key));
  return cookies[SESSION_COOKIE] || '';
}

function readClientAddress(req: ApiRequest) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const forwardedText = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const realIp = req.headers?.['x-real-ip'];
  const realIpText = Array.isArray(realIp) ? realIp[0] : realIp;
  return String(req.ip || req.socket?.remoteAddress || realIpText || forwardedText || 'unknown')
    .split(',')[0]
    .trim()
    .slice(0, 128);
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function hashToken(token: string, secret: string) {
  return createHmac('sha256', secret).update(token).digest('hex');
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV !== 'production') {
    return 'local-dev-session-secret';
  }
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret.includes('replace-with'))) {
    throw new Error('SESSION_SECRET must be a random value of at least 32 characters');
  }
  return secret;
}
