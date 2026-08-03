import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Order } from '../types/order';
import type { UserRecord } from './_auth-utils';
import type { ApiRequest } from './_order-utils';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';
import { DeliveryQuoteError, getDeliveryRouteForAddress, type DeliveryQuote } from './_delivery-utils';

export type DeliveryFeeTier = { maxKm: number; fee: number };
export type DeliverySettings = {
  maxAutoDistanceKm: number;
  lalamoveEnabled: boolean;
  lalamoveMarkupPercent: number;
  quoteLockMinutes: number;
  requestExpiryMinutes: number;
  approvalExpiryMinutes: number;
  fallbackFeeTiers: DeliveryFeeTier[];
};

export type PublicDeliveryQuote = {
  deliverability: 'deliverable';
  token: string;
  expiresAt: string;
  source: 'lalamove' | 'fallback';
  route: DeliveryQuote;
};

type DeliveryQuoteRecord = {
  id: string;
  user_id?: string | null;
  branch_id: string;
  branch_name: string;
  address: string;
  address_hash: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  duration_min: number;
  deliverability: 'deliverable' | 'manual_confirmation_required';
  source: 'lalamove' | 'fallback';
  customer_fee: number;
  expires_at: string;
};

type ApprovalRecord = {
  id: string;
  user_id: string;
  status: string;
  branch_id: string;
  branch_name: string;
  address: string;
  address_hash: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  duration_min: number;
  cart_hash: string;
  approved_delivery_fee?: number | null;
  approval_expires_at?: string | null;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  maxAutoDistanceKm: 20,
  lalamoveEnabled: false,
  lalamoveMarkupPercent: 15,
  quoteLockMinutes: 30,
  requestExpiryMinutes: 120,
  approvalExpiryMinutes: 30,
  fallbackFeeTiers: [
    { maxKm: 3, fee: 6 },
    { maxKm: 5, fee: 8 },
    { maxKm: 8, fee: 12 },
    { maxKm: 10, fee: 15 },
    { maxKm: 12, fee: 18 },
    { maxKm: 15, fee: 22 },
    { maxKm: 18, fee: 26 },
    { maxKm: 20, fee: 30 },
  ],
};

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  try {
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/delivery_settings?id=eq.default&select=*&limit=1',
      { method: 'GET' },
    );
    const row = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
    if (!row) return DEFAULT_DELIVERY_SETTINGS;
    return validateDeliverySettings({
      maxAutoDistanceKm: Number(row.max_auto_distance_km),
      lalamoveEnabled: Boolean(row.lalamove_enabled),
      lalamoveMarkupPercent: Number(row.lalamove_markup_percent),
      quoteLockMinutes: Number(row.quote_lock_minutes),
      requestExpiryMinutes: Number(row.request_expiry_minutes),
      approvalExpiryMinutes: Number(row.approval_expiry_minutes),
      fallbackFeeTiers: row.fallback_fee_tiers as DeliveryFeeTier[],
    });
  } catch (error) {
    if (isMissingDeliverySchema(error)) return DEFAULT_DELIVERY_SETTINGS;
    throw error;
  }
}

export function validateDeliverySettings(input: DeliverySettings): DeliverySettings {
  const tiers = Array.isArray(input.fallbackFeeTiers)
    ? input.fallbackFeeTiers.map(tier => ({ maxKm: Number(tier.maxKm), fee: roundMoney(Number(tier.fee)) }))
    : [];
  if (!Number.isFinite(input.maxAutoDistanceKm) || input.maxAutoDistanceKm <= 0 || input.maxAutoDistanceKm > 100) throw new Error('自动配送上限必须为0-100km');
  if (!Number.isFinite(input.lalamoveMarkupPercent) || input.lalamoveMarkupPercent < 0 || input.lalamoveMarkupPercent > 200) throw new Error('Lalamove加价比例必须为0-200%');
  if (!Number.isInteger(input.quoteLockMinutes) || input.quoteLockMinutes < 5 || input.quoteLockMinutes > 180) throw new Error('报价锁定时间必须为5-180分钟');
  if (!Number.isInteger(input.requestExpiryMinutes) || input.requestExpiryMinutes < 15 || input.requestExpiryMinutes > 1440) throw new Error('申请有效期必须为15-1440分钟');
  if (!Number.isInteger(input.approvalExpiryMinutes) || input.approvalExpiryMinutes < 5 || input.approvalExpiryMinutes > 240) throw new Error('审批有效期必须为5-240分钟');
  if (tiers.length === 0 || tiers.some((tier, index) => !Number.isFinite(tier.maxKm) || tier.maxKm <= (tiers[index - 1]?.maxKm || 0) || !Number.isFinite(tier.fee) || tier.fee < 0)) {
    throw new Error('备用配送费阶梯必须按距离递增且费用不能为负数');
  }
  if (tiers[tiers.length - 1].maxKm !== input.maxAutoDistanceKm) throw new Error('最后一个价格阶梯必须等于自动配送上限');
  return { ...input, fallbackFeeTiers: tiers };
}

export function calculateFallbackFee(distanceKm: number, settings: DeliverySettings) {
  const tier = settings.fallbackFeeTiers.find(item => distanceKm <= item.maxKm);
  if (!tier) throw new DeliveryQuoteError('OUT_OF_RANGE', `该地址超过 ${settings.maxAutoDistanceKm}km 自动配送范围`);
  return tier.fee;
}

export async function createDeliveryQuote(params: {
  req: ApiRequest;
  address: string;
  preferredBranchId?: string;
  user?: UserRecord | null;
}): Promise<PublicDeliveryQuote | { deliverability: 'manual_confirmation_required'; route: DeliveryQuote; maxDistanceKm: number }> {
  const settings = await getDeliverySettings();
  const actorHash = hashActor(params.req, params.user?.id);
  await enforceQuoteRateLimit(actorHash);
  const route = await getDeliveryRouteForAddress(params.address, params.preferredBranchId);
  if (route.distanceKm > settings.maxAutoDistanceKm) {
    await recordManualQuoteAttempt(route, params.address, actorHash, params.user?.id, settings.quoteLockMinutes);
    return { deliverability: 'manual_confirmation_required', route, maxDistanceKm: settings.maxAutoDistanceKm };
  }

  const providerResult = await getProviderPrice(route, settings);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + settings.quoteLockMinutes * 60_000).toISOString();
  const customerFee = providerResult.source === 'lalamove'
    ? calculateCustomerDeliveryFee(Number(providerResult.cost), settings.lalamoveMarkupPercent)
    : calculateFallbackFee(route.distanceKm, settings);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/delivery_quotes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      token_hash: hashToken(token),
      user_id: params.user?.id || null,
      actor_hash: actorHash,
      branch_id: route.branchId,
      branch_name: route.branchName,
      address: normalizeAddress(params.address),
      address_hash: hashAddress(params.address),
      latitude: route.addressLatitude,
      longitude: route.addressLongitude,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      deliverability: 'deliverable',
      source: providerResult.source,
      provider_quote_id: providerResult.quoteId || null,
      provider_cost: providerResult.cost ?? null,
      customer_fee: customerFee,
      fallback_reason: providerResult.fallbackReason || null,
      expires_at: expiresAt,
    }),
  });
  const record = Array.isArray(created) ? created[0] as { id?: string } | undefined : undefined;
  if (!record?.id) throw new DeliveryQuoteError('ROUTE_FAILED', '配送报价暂时无法保存', 500);
  return {
    deliverability: 'deliverable',
    token,
    expiresAt,
    source: providerResult.source,
    route: { ...route, deliveryFee: customerFee, provider: providerResult.source },
  };
}

export async function applyValidatedDeliveryToOrder(order: Order, user?: UserRecord | null) {
  if (order.orderType !== 'takeaway') {
    order.deliveryFee = 0;
    order.deliveryQuote = undefined;
    order.deliveryQuoteId = undefined;
    order.deliveryApprovalRequestId = undefined;
    return;
  }
  const address = order.takeaway?.address || '';
  if (order.deliveryApprovalRequestId) {
    if (!user) throw new DeliveryQuoteError('APPROVAL_REQUIRED', '请登录后使用超范围配送审批', 401);
    const approval = await getApproval(order.deliveryApprovalRequestId);
    if (!approval || approval.user_id !== user.id) throw new DeliveryQuoteError('APPROVAL_REQUIRED', '配送审批不存在或不属于当前用户', 403);
    if (approval.status !== 'approved' || isExpiredTimestamp(approval.approval_expires_at)) {
      throw new DeliveryQuoteError('QUOTE_EXPIRED', '配送审批已过期，请重新联系客服确认', 409);
    }
    if (approval.address_hash !== hashAddress(address) || approval.cart_hash !== createOrderCartHash(order)) {
      throw new DeliveryQuoteError('APPROVAL_REQUIRED', '地址或购物车已变更，请重新提交配送申请', 409);
    }
    applyResolvedRoute(order, {
      branchId: approval.branch_id,
      branchName: approval.branch_name,
      addressLatitude: Number(approval.latitude),
      addressLongitude: Number(approval.longitude),
      distanceKm: Number(approval.distance_km),
      durationMin: Number(approval.duration_min),
      deliveryFee: Number(approval.approved_delivery_fee || 0),
      provider: 'manual-approved',
    });
    return;
  }

  if (!order.deliveryQuoteToken) throw new DeliveryQuoteError('QUOTE_EXPIRED', '请重新获取配送报价', 409);
  const quote = await getQuoteByToken(order.deliveryQuoteToken);
  if (!quote || quote.deliverability !== 'deliverable' || isExpiredTimestamp(quote.expires_at)) throw new DeliveryQuoteError('QUOTE_EXPIRED', '配送报价已过期，请刷新报价', 409);
  if (quote.user_id && quote.user_id !== user?.id) throw new DeliveryQuoteError('QUOTE_EXPIRED', '配送报价不属于当前用户', 403);
  if (quote.address_hash !== hashAddress(address)) throw new DeliveryQuoteError('QUOTE_EXPIRED', '配送地址已变更，请重新报价', 409);
  order.deliveryQuoteId = quote.id;
  applyResolvedRoute(order, {
    branchId: quote.branch_id,
    branchName: quote.branch_name,
    addressLatitude: Number(quote.latitude),
    addressLongitude: Number(quote.longitude),
    distanceKm: Number(quote.distance_km),
    durationMin: Number(quote.duration_min),
    deliveryFee: Number(quote.customer_fee),
    provider: quote.source,
  });
}

export async function consumeDeliveryApproval(order: Order, orderRecordId: string) {
  if (!order.deliveryApprovalRequestId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/delivery_approval_requests?id=eq.${encodeURIComponent(order.deliveryApprovalRequestId)}&status=eq.approved&consumed_order_id=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'consumed', consumed_order_id: orderRecordId, consumed_at: new Date().toISOString() }),
    },
  );
  if (!Array.isArray(rows) || !rows[0]) throw new DeliveryQuoteError('APPROVAL_REQUIRED', '配送审批已被使用，请勿重复提交', 409);
}

export function createOrderCartHash(order: Order) {
  const canonical = order.items.map(item => ({
    id: String(item.id),
    qty: Number(item.qty),
    price: roundMoney(Number(item.price)),
    options: [...(item.options || [])].map(option => ({ groupId: option.groupId, optionId: option.optionId, priceDelta: roundMoney(option.priceDelta) }))
      .sort((a, b) => `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`)),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function calculateCustomerDeliveryFee(providerCost: number, markupPercent: number) {
  if (!Number.isFinite(providerCost) || providerCost < 0) throw new Error('Lalamove报价不正确');
  if (!Number.isFinite(markupPercent) || markupPercent < 0) throw new Error('配送加价比例不正确');
  return Math.max(0, Math.ceil(providerCost * (1 + markupPercent / 100)));
}

export function isExpiredTimestamp(value?: string | null, now = Date.now()) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now;
}

export function isQuoteRateLimited(records: { created_at: string }[], now = Date.now()) {
  const tenMinutesAgo = now - 10 * 60_000;
  const dayAgo = now - 24 * 60 * 60_000;
  const recentDay = records.filter(row => {
    const createdAt = new Date(row.created_at).getTime();
    return Number.isFinite(createdAt) && createdAt > dayAgo;
  });
  return recentDay.length >= 60 || recentDay.filter(row => new Date(row.created_at).getTime() > tenMinutesAgo).length >= 10;
}

export function hasReachedApprovalRequestLimit(recentRequestCount: number) {
  return recentRequestCount >= 3;
}

export function createLalamoveSignature(timestamp: string, method: string, path: string, body: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`).digest('hex');
}

export function hashAddress(address: string) {
  return createHash('sha256').update(normalizeAddress(address).toLowerCase()).digest('hex');
}

export function normalizeAddress(address: string) {
  return String(address || '').trim().replace(/\s+/g, ' ');
}

function applyResolvedRoute(order: Order, quote: DeliveryQuote) {
  order.deliveryFee = quote.deliveryFee;
  order.deliveryQuote = quote;
  order.assignedBranch = { id: quote.branchId, name: quote.branchName };
}

async function getQuoteByToken(token: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_quotes?token_hash=eq.${hashToken(token)}&select=*&limit=1`, { method: 'GET' });
  return Array.isArray(rows) ? rows[0] as DeliveryQuoteRecord | undefined : undefined;
}

async function getApproval(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: 'GET' });
  return Array.isArray(rows) ? rows[0] as ApprovalRecord | undefined : undefined;
}

async function enforceQuoteRateLimit(actorHash: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/delivery_quotes?actor_hash=eq.${actorHash}&created_at=gt.${encodeURIComponent(dayAgo)}&select=created_at&order=created_at.desc&limit=61`,
    { method: 'GET' },
  );
  const records = Array.isArray(rows) ? rows as { created_at: string }[] : [];
  if (isQuoteRateLimited(records)) {
    throw new DeliveryQuoteError('ROUTE_FAILED', '配送报价请求过于频繁，请稍后重试', 429);
  }
}

async function recordManualQuoteAttempt(route: DeliveryQuote, address: string, actorHash: string, userId: string | undefined, quoteLockMinutes: number) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/delivery_quotes', {
    method: 'POST',
    body: JSON.stringify({
      token_hash: hashToken(randomBytes(32).toString('base64url')),
      user_id: userId || null,
      actor_hash: actorHash,
      branch_id: route.branchId,
      branch_name: route.branchName,
      address: normalizeAddress(address),
      address_hash: hashAddress(address),
      latitude: route.addressLatitude,
      longitude: route.addressLongitude,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      deliverability: 'manual_confirmation_required',
      source: 'fallback',
      customer_fee: 0,
      fallback_reason: 'manual_confirmation_required',
      expires_at: new Date(Date.now() + quoteLockMinutes * 60_000).toISOString(),
    }),
  });
}

async function getProviderPrice(route: DeliveryQuote, settings: DeliverySettings): Promise<{ source: 'lalamove' | 'fallback'; cost?: number; quoteId?: string; fallbackReason?: string }> {
  const apiKey = process.env.LALAMOVE_API_KEY?.trim();
  const apiSecret = process.env.LALAMOVE_API_SECRET?.trim();
  if (!settings.lalamoveEnabled || !apiKey || !apiSecret) return { source: 'fallback', fallbackReason: !settings.lalamoveEnabled ? 'disabled' : 'credentials_missing' };
  try {
    const cached = await getCachedLalamovePrice(route);
    if (cached) return cached;
    return await requestLalamoveQuote(route, apiKey, apiSecret);
  } catch (error) {
    console.error('Lalamove quotation failed; using fallback pricing:', error instanceof Error ? error.message : error);
    return { source: 'fallback', fallbackReason: error instanceof Error ? error.message.slice(0, 200) : 'lalamove_failed' };
  }
}

async function getCachedLalamovePrice(route: DeliveryQuote) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const path = `/delivery_quotes?branch_id=eq.${encodeURIComponent(route.branchId)}&latitude=eq.${route.addressLatitude}&longitude=eq.${route.addressLongitude}&source=eq.lalamove&created_at=gt.${encodeURIComponent(since)}&provider_cost=not.is.null&select=provider_cost,provider_quote_id&order=created_at.desc&limit=1`;
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, path, { method: 'GET' });
  const row = Array.isArray(rows) ? rows[0] as { provider_cost?: number; provider_quote_id?: string } | undefined : undefined;
  return row?.provider_cost != null ? { source: 'lalamove' as const, cost: Number(row.provider_cost), quoteId: row.provider_quote_id } : null;
}

async function requestLalamoveQuote(route: DeliveryQuote, apiKey: string, apiSecret: string) {
  if (!Number.isFinite(route.branchLatitude) || !Number.isFinite(route.branchLongitude)) throw new Error('branch_coordinates_missing');
  const body = JSON.stringify({ data: {
    serviceType: 'MOTORCYCLE',
    language: 'en_MY',
    stops: [
      { coordinates: { lat: String(route.branchLatitude), lng: String(route.branchLongitude) }, address: route.branchName },
      { coordinates: { lat: String(route.addressLatitude), lng: String(route.addressLongitude) }, address: 'Customer delivery address' },
    ],
    isRouteOptimized: false,
  } });
  const timestamp = Date.now().toString();
  const path = '/v3/quotations';
  const signature = createLalamoveSignature(timestamp, 'POST', path, body, apiSecret);
  const host = process.env.LALAMOVE_API_ENV === 'production' ? 'https://rest.lalamove.com' : 'https://rest.sandbox.lalamove.com';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${host}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `hmac ${apiKey}:${timestamp}:${signature}`,
        'Content-Type': 'application/json',
        Market: 'MY',
        'Request-ID': randomUUID(),
      },
      body,
      signal: controller.signal,
    });
    const payload = await response.json() as { data?: { quotationId?: string; priceBreakdown?: { total?: string; currency?: string } }; message?: string };
    const total = Number(payload.data?.priceBreakdown?.total);
    if (!response.ok || !Number.isFinite(total) || total < 0 || payload.data?.priceBreakdown?.currency !== 'MYR') throw new Error(payload.message || `lalamove_${response.status}`);
    return { source: 'lalamove' as const, cost: roundMoney(total), quoteId: payload.data?.quotationId };
  } finally {
    clearTimeout(timer);
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function hashActor(req: ApiRequest, userId?: string) {
  if (userId) return createHash('sha256').update(`user:${userId}`).digest('hex');
  const forwarded = header(req, 'x-forwarded-for').split(',')[0].trim();
  const userAgent = header(req, 'user-agent').slice(0, 200);
  const secret = process.env.SESSION_SECRET || 'delivery-rate-limit';
  return createHmac('sha256', secret).update(`${forwarded}|${userAgent}`).digest('hex');
}

function header(req: ApiRequest, name: string) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function isMissingDeliverySchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('delivery_settings') && (message.includes('does not exist') || message.includes('PGRST205') || message.includes('42P01'));
}
