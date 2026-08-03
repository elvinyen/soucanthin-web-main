import { AdminError, enforceAdminBranch, hasAllBranchAccess, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import { getDeliverySettings } from './_delivery-policy';
import { type ApiRequest, type ApiResponse, getSupabaseConfig, supabaseRequest } from './_order-utils';

const PUBLIC_COLUMNS = 'id,request_no,user_id,status,branch_id,branch_name,customer_name,customer_phone,address,distance_km,duration_min,subtotal,approved_delivery_fee,delivery_provider,estimated_delivery_min,customer_note,review_note,reviewed_by_name,reviewed_at,request_expires_at,approval_expires_at,created_at,updated_at';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';
    if (method === 'GET') return await listRequests(req, res, admin);
    if (method === 'PATCH' || method === 'POST') return await reviewRequest(req, res, admin);
    res.setHeader?.('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function listRequests(req: ApiRequest, res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  await expireAllRequests();
  const status = parseQuery(req.url).get('status') || 'pending';
  if (!['pending', 'approved', 'rejected', 'cancelled', 'expired', 'consumed', 'all'].includes(status)) throw new AdminError('申请状态不正确');
  const filter = `${status === 'all' ? '' : `status=eq.${status}&`}${hasAllBranchAccess(admin) ? '' : `branch_id=eq.${encodeURIComponent(enforceAdminBranch(admin) || '')}&`}`;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?${filter}select=${PUBLIC_COLUMNS}&order=created_at.desc&limit=100`, { method: 'GET' });
  return res.status(200).json({ success: true, requests: Array.isArray(rows) ? rows.map(toPublic) : [], syncedAt: new Date().toISOString() });
}

async function reviewRequest(req: ApiRequest, res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  const input = parseAdminBody<Record<string, unknown>>(req.body);
  const id = String(input.id || '').trim();
  const action = String(input.action || '');
  if (!id) throw new AdminError('缺少配送申请ID');
  if (!['approve', 'reject'].includes(action)) throw new AdminError('审批操作不正确');
  const reviewNote = cleanText(input.reviewNote, 500);
  if (action === 'reject' && !reviewNote) throw new AdminError('拒绝申请必须填写原因');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existingRows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?id=eq.${encodeURIComponent(id)}&select=id,branch_id&limit=1`, { method: 'GET' });
  const existing = Array.isArray(existingRows) ? existingRows[0] as { branch_id?: string } | undefined : undefined;
  if (!existing) throw new AdminError('配送申请不存在', 404);
  enforceAdminBranch(admin, existing.branch_id);
  const payload: Record<string, unknown> = {
    status: action === 'approve' ? 'approved' : 'rejected',
    review_note: reviewNote || null,
    reviewed_by: admin.id,
    reviewed_by_name: admin.displayName || admin.username,
    reviewed_at: new Date().toISOString(),
  };
  if (action === 'approve') {
    const fee = Number(input.deliveryFee);
    const provider = String(input.deliveryProvider || '').trim();
    const estimatedDeliveryMin = Number(input.estimatedDeliveryMin);
    if (!Number.isFinite(fee) || fee <= 0 || fee > 1000) throw new AdminError('请输入正确的配送费');
    if (!['lalamove', 'grab', 'in_house', 'other'].includes(provider)) throw new AdminError('请选择配送方式');
    if (!Number.isInteger(estimatedDeliveryMin) || estimatedDeliveryMin < 10 || estimatedDeliveryMin > 480) throw new AdminError('预计配送时间必须为10-480分钟');
    const settings = await getDeliverySettings();
    payload.approved_delivery_fee = Math.round(fee * 100) / 100;
    payload.delivery_provider = provider;
    payload.estimated_delivery_min = estimatedDeliveryMin;
    payload.approval_expires_at = new Date(Date.now() + settings.approvalExpiryMinutes * 60_000).toISOString();
  }

  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?id=eq.${encodeURIComponent(id)}&status=eq.pending&request_expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
  });
  const record = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
  if (!record) throw new AdminError('申请已处理或已过期', 409);
  return res.status(200).json({ success: true, request: toPublic(record) });
}

async function expireAllRequests() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?status=eq.pending&request_expires_at=lt.${encodeURIComponent(now)}`, { method: 'PATCH', body: JSON.stringify({ status: 'expired' }) }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/delivery_approval_requests?status=eq.approved&approval_expires_at=lt.${encodeURIComponent(now)}`, { method: 'PATCH', body: JSON.stringify({ status: 'expired' }) }),
  ]);
}

function toPublic(row: Record<string, unknown>) {
  return {
    id: row.id, requestNo: row.request_no, status: row.status, branchName: row.branch_name,
    customerName: row.customer_name, customerPhone: row.customer_phone, address: row.address,
    distanceKm: Number(row.distance_km || 0), durationMin: Number(row.duration_min || 0), subtotal: Number(row.subtotal || 0),
    approvedDeliveryFee: row.approved_delivery_fee == null ? null : Number(row.approved_delivery_fee),
    deliveryProvider: row.delivery_provider || null, estimatedDeliveryMin: row.estimated_delivery_min == null ? null : Number(row.estimated_delivery_min),
    customerNote: row.customer_note || null, reviewNote: row.review_note || null, reviewedByName: row.reviewed_by_name || null,
    reviewedAt: row.reviewed_at || null, requestExpiresAt: row.request_expires_at, approvalExpiresAt: row.approval_expires_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}
