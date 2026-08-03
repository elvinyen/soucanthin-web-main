import { randomBytes } from 'node:crypto';
import type { Order } from '../types/order';
import { getAuthenticatedUser } from './_auth-utils';
import { createOrderCartHash, getDeliverySettings, hashAddress, hasReachedApprovalRequestLimit, normalizeAddress } from './_delivery-policy';
import { DeliveryQuoteError, getDeliveryRouteForAddress } from './_delivery-utils';
import {
  type ApiRequest,
  type ApiResponse,
  calculateTotals,
  getSupabaseConfig,
  parseOrderBody,
  supabaseRequest,
  validateMenuItemsAvailable,
} from './_order-utils';

type ApprovalRecord = Record<string, unknown> & {
  id: string;
  request_no: string;
  user_id: string;
  status: string;
  address_hash: string;
  cart_hash: string;
  request_expires_at: string;
  approval_expires_at?: string | null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ success: false, code: 'LOGIN_REQUIRED', error: '请先登录后提交超范围配送申请' });
    const method = req.method || 'GET';
    if (method === 'GET') return await getRequest(req, res, user.id);
    if (method === 'POST') return await createRequest(req, res, user);
    if (method === 'PATCH') return await cancelRequest(req, res, user.id);
    res.setHeader?.('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof DeliveryQuoteError) return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
    console.error('Delivery approval API error:', error);
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : '配送申请处理失败' });
  }
}

async function getRequest(req: ApiRequest, res: ApiResponse, userId: string) {
  await expireRequests(userId);
  const id = new URLSearchParams(req.url?.split('?')[1] || '').get('id') || '';
  const filter = id ? `id=eq.${encodeURIComponent(id)}&` : 'status=in.(pending,approved)&';
  const rows = await requestRows(`/delivery_approval_requests?user_id=eq.${encodeURIComponent(userId)}&${filter}select=*&order=created_at.desc&limit=1`);
  return res.status(200).json({ success: true, request: rows[0] ? publicRequest(rows[0]) : null });
}

async function createRequest(req: ApiRequest, res: ApiResponse, user: { id: string; display_phone: string; name?: string | null }) {
  const order = parseOrderBody(req.body) as Order;
  if (order.orderType !== 'takeaway' || !order.takeaway?.address?.trim()) throw new Error('请填写外卖配送地址');
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error('购物车不能为空');
  order.userId = user.id;
  order.customer = {
    name: String(order.customer?.name || user.name || '顾客').trim(),
    phone: String(order.customer?.phone || user.display_phone).trim(),
  };
  const availabilityError = await validateMenuItemsAvailable(order);
  if (availabilityError) throw new Error(availabilityError);

  const settings = await getDeliverySettings();
  const route = await getDeliveryRouteForAddress(order.takeaway.address, order.assignedBranch?.id);
  if (route.distanceKm <= settings.maxAutoDistanceKm) throw new Error(`该地址在${settings.maxAutoDistanceKm}km自动配送范围内，无需人工申请`);
  await expireRequests(user.id);

  const cartHash = createOrderCartHash(order);
  const addressHash = hashAddress(order.takeaway.address);
  const existing = await requestRows(`/delivery_approval_requests?user_id=eq.${encodeURIComponent(user.id)}&status=in.(pending,approved)&select=*&order=created_at.desc&limit=1`);
  if (existing[0]) {
    if (existing[0].address_hash === addressHash && existing[0].cart_hash === cartHash) {
      return res.status(200).json({ success: true, reused: true, request: publicRequest(existing[0]) });
    }
    return res.status(409).json({ success: false, code: 'ACTIVE_REQUEST_EXISTS', error: '您已有一条待处理配送申请，请先取消或等待客服处理' });
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const recent = await requestRows(`/delivery_approval_requests?user_id=eq.${encodeURIComponent(user.id)}&created_at=gt.${encodeURIComponent(since)}&select=id&limit=4`);
  if (hasReachedApprovalRequestLimit(recent.length)) return res.status(429).json({ success: false, code: 'REQUEST_LIMIT_REACHED', error: '今天提交的配送申请已达到上限，请直接联系客服' });

  const { subtotal } = calculateTotals(order);
  const requestNo = createRequestNo();
  const requestExpiresAt = new Date(Date.now() + settings.requestExpiryMinutes * 60_000).toISOString();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/delivery_approval_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      request_no: requestNo,
      user_id: user.id,
      status: 'pending',
      branch_id: route.branchId,
      branch_name: route.branchName,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      address: normalizeAddress(order.takeaway.address),
      address_hash: addressHash,
      latitude: route.addressLatitude,
      longitude: route.addressLongitude,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      cart_hash: cartHash,
      cart_snapshot: { items: order.items, note: order.note || order.takeaway.note || null },
      subtotal,
      customer_note: order.note?.trim() || order.takeaway.note?.trim() || null,
      request_expires_at: requestExpiresAt,
    }),
  });
  const record = Array.isArray(created) ? created[0] as ApprovalRecord | undefined : undefined;
  if (!record?.id) throw new Error('配送申请保存失败');
  return res.status(201).json({ success: true, request: publicRequest(record) });
}

async function cancelRequest(req: ApiRequest, res: ApiResponse, userId: string) {
  const body = parseObject(req.body);
  const id = String(body.id || '').trim();
  if (!id) throw new Error('缺少配送申请编号');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const updated = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/delivery_approval_requests?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&status=in.(pending,approved)`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'cancelled' }) },
  );
  const record = Array.isArray(updated) ? updated[0] as ApprovalRecord | undefined : undefined;
  if (!record) return res.status(409).json({ success: false, error: '配送申请已处理或不存在' });
  return res.status(200).json({ success: true, request: publicRequest(record) });
}

async function expireRequests(userId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&request_expires_at=lt.${encodeURIComponent(now)}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'expired' }),
    }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.approved&approval_expires_at=lt.${encodeURIComponent(now)}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'expired' }),
    }),
  ]);
}

async function requestRows(path: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, path, { method: 'GET' });
  return Array.isArray(rows) ? rows as ApprovalRecord[] : [];
}

function publicRequest(row: ApprovalRecord) {
  return {
    id: row.id,
    requestNo: row.request_no,
    status: row.status,
    branchName: row.branch_name,
    address: row.address,
    distanceKm: Number(row.distance_km || 0),
    durationMin: Number(row.duration_min || 0),
    subtotal: Number(row.subtotal || 0),
    approvedDeliveryFee: row.approved_delivery_fee == null ? null : Number(row.approved_delivery_fee),
    deliveryProvider: row.delivery_provider || null,
    estimatedDeliveryMin: row.estimated_delivery_min == null ? null : Number(row.estimated_delivery_min),
    reviewNote: row.review_note || null,
    requestExpiresAt: row.request_expires_at,
    approvalExpiresAt: row.approval_expires_at || null,
    createdAt: row.created_at,
  };
}

function createRequestNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `DQ-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function parseObject(body: unknown) {
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as Record<string, unknown>;
  if (typeof body === 'string') return JSON.parse(body) as Record<string, unknown>;
  return (body || {}) as Record<string, unknown>;
}
