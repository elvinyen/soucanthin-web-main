import { createHmac, randomBytes } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';
import type { AuthUser, UserAddress, UserCoupon, UserOrderSummary, WalletSummary, WalletTransaction } from '../types/auth';

const SESSION_COOKIE = 'sct_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type UserRecord = {
  id: string;
  phone: string;
  display_phone: string;
  name?: string | null;
  email?: string | null;
  birthday?: string | null;
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

  if (digits.startsWith('60')) {
    normalized = digits;
  } else if (digits.startsWith('0')) {
    normalized = `60${digits.slice(1)}`;
  } else if (digits.startsWith('1')) {
    normalized = `60${digits}`;
  }

  if (!/^60\d{8,11}$/.test(normalized)) {
    throw new Error('请输入有效的马来西亚手机号');
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
    body: JSON.stringify({ phone, display_phone: displayPhone, last_login_at: now }),
  });
  const user = Array.isArray(created) ? created[0] as UserRecord : null;
  if (!user?.id) throw new Error('User was not saved');
  await ensureWallet(user.id);
  return user;
}

export async function createSession(userId: string) {
  const secret = getSessionSecret();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token, secret);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  await supabaseRequest(supabaseUrl, serviceRoleKey, '/user_sessions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    }),
  });

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
    `/orders?user_id=eq.${encodeURIComponent(userId)}&select=id,order_no,order_type,payment_method,customer_name,customer_phone,table_no,delivery_address,note,subtotal,service_charge,total,discount_amount,payable_total,status,payment_status,payment_review_status,created_at&order=created_at.desc&limit=20`,
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
    serviceCharge: Number(row.service_charge || 0),
    discountAmount: Number(row.discount_amount || 0),
    payableTotal: Number(row.payable_total ?? row.total ?? 0),
    status: row.status,
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
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?user_id=eq.${encodeURIComponent(userId)}&select=id,status,expires_at,used_at,coupons(code,title,description,discount_amount)&order=created_at.desc`,
    { method: 'GET' },
  );
  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: row.id,
    code: row.coupons?.code || '',
    title: row.coupons?.title || '优惠券',
    description: row.coupons?.description || null,
    discountAmount: Number(row.coupons?.discount_amount || 0),
    status: row.status,
    expiresAt: row.expires_at,
    usedAt: row.used_at || null,
  }));
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
  return secret;
}
