import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type CouponStatus = 'draft' | 'active' | 'paused' | 'ended';
type DiscountType = 'fixed' | 'percentage';

type CouponRow = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discount_amount: number | string;
  discount_type: DiscountType;
  discount_value: number | string;
  min_order_amount: number | string;
  max_discount_amount?: number | string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  validity_days?: number | null;
  total_issue_limit?: number | null;
  per_user_limit: number;
  applicable_order_types?: string[] | null;
  applicable_payment_methods?: string[] | null;
  applicable_branch_ids?: string[] | null;
  exclude_delivery_fee: boolean;
  status: CouponStatus;
  created_at: string;
  updated_at?: string | null;
};

type UserCouponRow = {
  id: string;
  user_id: string;
  coupon_id: string;
  status: 'available' | 'reserved' | 'used' | 'expired' | 'revoked';
  source?: string | null;
  expires_at?: string | null;
  issued_at?: string | null;
  used_at?: string | null;
  reserved_at?: string | null;
  reservation_expires_at?: string | null;
  used_order_id?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  users?: { name?: string | null; phone?: string | null; display_phone?: string | null } | null;
  coupons?: Pick<CouponRow, 'code' | 'title' | 'discount_type' | 'discount_value' | 'min_order_amount'> | null;
};

const CAMPAIGN_SELECT = 'id,code,title,description,discount_amount,discount_type,discount_value,min_order_amount,max_discount_amount,valid_from,valid_until,validity_days,total_issue_limit,per_user_limit,applicable_order_types,applicable_payment_methods,applicable_branch_ids,exclude_delivery_fee,status,created_at,updated_at';
const RECORD_SELECT = 'id,user_id,coupon_id,status,source,expires_at,issued_at,used_at,reserved_at,reservation_expires_at,used_order_id,revoked_at,revoke_reason,users(name,phone,display_phone),coupons(code,title,discount_type,discount_value,min_order_amount)';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';
    if (method === 'GET') return await getCouponCenter(req, res);
    if (method === 'POST') return await createOrIssueCoupon(req, res, admin);
    if (method === 'PATCH' || method === 'PUT') return await updateCoupon(req, res, admin);
    res.setHeader?.('Allow', 'GET, POST, PATCH, PUT');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getCouponCenter(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const search = String(query.get('search') || '').trim().toLowerCase();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await expireOldReservations(supabaseUrl, serviceRoleKey);

  const [campaignsRaw, recordsRaw, ordersRaw] = await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/coupons?select=${CAMPAIGN_SELECT}&order=created_at.desc`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?select=${RECORD_SELECT}&order=issued_at.desc&limit=500`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/orders?coupon_id=not.is.null&select=id,order_no,coupon_id,discount_amount,payable_total,total,status,created_at&order=created_at.desc&limit=1000', { method: 'GET' }),
  ]);
  const campaigns = (Array.isArray(campaignsRaw) ? campaignsRaw as CouponRow[] : []).map(mapCampaign);
  const records = Array.isArray(recordsRaw) ? recordsRaw as UserCouponRow[] : [];
  const orders = Array.isArray(ordersRaw) ? ordersRaw as Array<Record<string, unknown>> : [];
  const orderMap = new Map(orders.map(order => [String(order.id), order]));
  const campaignCounts = new Map<string, { issued: number; used: number; reserved: number }>();
  records.forEach(record => {
    const counts = campaignCounts.get(record.coupon_id) || { issued: 0, used: 0, reserved: 0 };
    counts.issued += 1;
    if (record.status === 'used') counts.used += 1;
    if (record.status === 'reserved') counts.reserved += 1;
    campaignCounts.set(record.coupon_id, counts);
  });
  const campaignsWithCounts = campaigns.map(campaign => ({
    ...campaign,
    ...(campaignCounts.get(campaign.id) || { issued: 0, used: 0, reserved: 0 }),
  }));
  const mappedRecords = records.map(record => mapRecord(record, orderMap.get(String(record.used_order_id || '')))).filter(record => {
    if (!search) return true;
    return [record.customerName, record.phone, record.couponTitle, record.couponCode, record.orderNo]
      .some(value => value.toLowerCase().includes(search));
  });
  const validOrders = orders.filter(order => String(order.status) !== 'cancelled');
  const discountCost = validOrders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0);
  const sales = validOrders.reduce((sum, order) => sum + Number(order.payable_total ?? order.total ?? 0), 0);
  const usedCount = records.filter(record => record.status === 'used').length;

  return res.status(200).json({
    success: true,
    campaigns: campaignsWithCounts,
    records: mappedRecords,
    summary: {
      activeCampaigns: campaigns.filter(campaign => campaign.status === 'active').length,
      issued: records.length,
      used: usedCount,
      reserved: records.filter(record => record.status === 'reserved').length,
      redemptionRate: records.length ? Number(((usedCount / records.length) * 100).toFixed(1)) : 0,
      discountCost: roundMoney(discountCost),
      sales: roundMoney(sales),
      averageOrder: validOrders.length ? roundMoney(sales / validOrders.length) : 0,
    },
  });
}

async function createOrIssueCoupon(
  req: ApiRequest,
  res: ApiResponse,
  admin: Awaited<ReturnType<typeof requireAdminRole>>,
) {
  const input = parseAdminBody<Record<string, unknown>>(req.body);
  const action = String(input.action || 'create');
  if (action === 'issue') return await issueCoupon(res, input, admin);
  const payload = normalizeCampaignInput(input);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/coupons', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const campaign = Array.isArray(created) ? created[0] as CouponRow | undefined : undefined;
  if (!campaign?.id) throw new AdminError('优惠券创建失败', 500);
  return res.status(201).json({ success: true, campaign: mapCampaign(campaign) });
}

async function issueCoupon(
  res: ApiResponse,
  input: Record<string, unknown>,
  admin: Awaited<ReturnType<typeof requireAdminRole>>,
) {
  const couponId = String(input.couponId || '').trim();
  const userIds = Array.from(new Set((Array.isArray(input.userIds) ? input.userIds : []).map(value => String(value).trim()).filter(Boolean)));
  const reason = String(input.reason || '').trim();
  if (!couponId) throw new AdminError('请选择优惠券');
  if (!userIds.length) throw new AdminError('请选择至少一位用户');
  const issueLimit = admin.role === 'admin' ? 500 : 20;
  if (userIds.length > issueLimit) throw new AdminError(`当前账号单次最多向 ${issueLimit} 位用户发券`);
  if (reason.length < 2) throw new AdminError('请填写发放原因');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const campaignRows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/coupons?id=eq.${encodeURIComponent(couponId)}&status=eq.active&select=${CAMPAIGN_SELECT}`, { method: 'GET' });
  const campaign = Array.isArray(campaignRows) ? campaignRows[0] as CouponRow | undefined : undefined;
  if (!campaign) throw new AdminError('优惠券不存在或未上线');
  if (campaign.valid_until && new Date(campaign.valid_until).getTime() <= Date.now()) throw new AdminError('优惠券活动已结束');

  const allExistingRaw = await supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?coupon_id=eq.${encodeURIComponent(couponId)}&select=user_id`, { method: 'GET' });
  const existingRows = Array.isArray(allExistingRaw) ? allExistingRaw as Array<{ user_id: string }> : [];
  if (campaign.total_issue_limit && existingRows.length >= campaign.total_issue_limit) throw new AdminError('优惠券已达到总发行上限');
  const countByUser = new Map<string, number>();
  existingRows.forEach(row => countByUser.set(row.user_id, (countByUser.get(row.user_id) || 0) + 1));
  const remainingTotal = campaign.total_issue_limit ? Math.max(campaign.total_issue_limit - existingRows.length, 0) : userIds.length;
  const eligible = userIds.filter(userId => (countByUser.get(userId) || 0) < Number(campaign.per_user_limit || 1)).slice(0, remainingTotal);
  if (!eligible.length) throw new AdminError('所选用户均已达到领取上限');
  const expiresAt = calculateExpiry(campaign);
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/user_coupons', {
    method: 'POST',
    body: JSON.stringify(eligible.map(userId => ({
      user_id: userId,
      coupon_id: couponId,
      status: 'available',
      source: 'admin',
      issued_by_admin_id: admin.id,
      issued_at: new Date().toISOString(),
      expires_at: expiresAt,
    }))),
  });
  return res.status(201).json({ success: true, issued: eligible.length, skipped: userIds.length - eligible.length });
}

async function updateCoupon(
  req: ApiRequest,
  res: ApiResponse,
  admin: Awaited<ReturnType<typeof requireAdminRole>>,
) {
  const input = parseAdminBody<Record<string, unknown>>(req.body);
  const action = String(input.action || 'status');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (action === 'revoke') {
    const id = String(input.id || '').trim();
    const reason = String(input.reason || '').trim();
    if (!id || reason.length < 2) throw new AdminError('请填写撤销原因');
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?id=eq.${encodeURIComponent(id)}&status=eq.available`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by_admin_id: admin.id, revoke_reason: reason }),
    });
    return res.status(200).json({ success: true });
  }
  const id = String(input.id || '').trim();
  const status = String(input.status || '') as CouponStatus;
  if (!id || !['draft', 'active', 'paused', 'ended'].includes(status)) throw new AdminError('活动状态不正确');
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/coupons?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  return res.status(200).json({ success: true });
}

function normalizeCampaignInput(input: Record<string, unknown>) {
  const code = String(input.code || '').trim().toUpperCase();
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  const discountType = String(input.discountType || 'fixed') as DiscountType;
  const discountValue = Number(input.discountValue);
  const minOrderAmount = Number(input.minOrderAmount || 0);
  const maxDiscountAmount = input.maxDiscountAmount === '' || input.maxDiscountAmount == null ? null : Number(input.maxDiscountAmount);
  const totalIssueLimit = input.totalIssueLimit === '' || input.totalIssueLimit == null ? null : Number(input.totalIssueLimit);
  const validityDays = input.validityDays === '' || input.validityDays == null ? null : Number(input.validityDays);
  const perUserLimit = Number(input.perUserLimit || 1);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new AdminError('券码需为 3-32 位大写字母、数字、下划线或横线');
  if (!title || title.length > 80) throw new AdminError('请填写 1-80 字的优惠券名称');
  if (!['fixed', 'percentage'].includes(discountType)) throw new AdminError('优惠类型不正确');
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percentage' && discountValue > 100)) throw new AdminError('优惠值不正确');
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) throw new AdminError('最低消费金额不正确');
  if (!Number.isInteger(perUserLimit) || perUserLimit < 1 || perUserLimit > 100) throw new AdminError('每人限领数量不正确');
  if (validityDays != null && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650)) throw new AdminError('领取后有效天数不正确');
  if (totalIssueLimit != null && (!Number.isInteger(totalIssueLimit) || totalIssueLimit < 1)) throw new AdminError('总发行量不正确');
  const status = String(input.status || 'draft') as CouponStatus;
  if (!['draft', 'active'].includes(status)) throw new AdminError('初始活动状态不正确');
  return {
    code,
    title,
    description: description || null,
    discount_type: discountType,
    discount_value: roundMoney(discountValue),
    discount_amount: discountType === 'fixed' ? roundMoney(discountValue) : 0,
    min_order_amount: roundMoney(minOrderAmount),
    max_discount_amount: maxDiscountAmount == null ? null : roundMoney(maxDiscountAmount),
    valid_from: normalizeOptionalDate(input.validFrom),
    valid_until: normalizeOptionalDate(input.validUntil),
    validity_days: validityDays,
    total_issue_limit: totalIssueLimit,
    per_user_limit: perUserLimit,
    applicable_order_types: normalizeChoiceArray(input.applicableOrderTypes, ['dinein', 'takeaway']),
    applicable_payment_methods: normalizeChoiceArray(input.applicablePaymentMethods, ['cash', 'tng', 'stripe', 'wallet']),
    applicable_branch_ids: normalizeStringArray(input.applicableBranchIds),
    exclude_delivery_fee: input.excludeDeliveryFee !== false,
    status,
  };
}

function mapCampaign(row: CouponRow) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || '',
    discountType: row.discount_type || 'fixed',
    discountValue: Number(row.discount_value ?? row.discount_amount ?? 0),
    minOrderAmount: Number(row.min_order_amount || 0),
    maxDiscountAmount: row.max_discount_amount == null ? null : Number(row.max_discount_amount),
    validFrom: row.valid_from || null,
    validUntil: row.valid_until || null,
    validityDays: row.validity_days || null,
    totalIssueLimit: row.total_issue_limit || null,
    perUserLimit: Number(row.per_user_limit || 1),
    applicableOrderTypes: row.applicable_order_types || ['dinein', 'takeaway'],
    applicablePaymentMethods: row.applicable_payment_methods || ['cash', 'tng', 'stripe', 'wallet'],
    applicableBranchIds: row.applicable_branch_ids || [],
    excludeDeliveryFee: row.exclude_delivery_fee !== false,
    status: row.status || 'active',
    createdAt: row.created_at,
  };
}

function mapRecord(row: UserCouponRow, order?: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.users?.name || '未命名用户',
    phone: row.users?.display_phone || row.users?.phone || '',
    couponTitle: row.coupons?.title || '优惠券',
    couponCode: row.coupons?.code || '',
    status: row.status,
    source: row.source || 'admin',
    expiresAt: row.expires_at || null,
    issuedAt: row.issued_at || null,
    reservedAt: row.reserved_at || null,
    usedAt: row.used_at || null,
    orderNo: String(order?.order_no || ''),
    revokeReason: row.revoke_reason || '',
  };
}

async function expireOldReservations(supabaseUrl: string, serviceRoleKey: string) {
  const now = new Date().toISOString();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?status=eq.reserved&reservation_expires_at=lt.${encodeURIComponent(now)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'available', reserved_at: null, reservation_expires_at: null, reserved_order_id: null }),
  });
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?status=eq.available&expires_at=lt.${encodeURIComponent(now)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'expired' }),
  });
}

function calculateExpiry(campaign: CouponRow) {
  const fixedExpiry = campaign.valid_until ? new Date(campaign.valid_until).getTime() : Number.POSITIVE_INFINITY;
  const rollingExpiry = campaign.validity_days ? Date.now() + campaign.validity_days * 86400000 : Number.POSITIVE_INFINITY;
  const expiry = Math.min(fixedExpiry, rollingExpiry);
  return Number.isFinite(expiry) ? new Date(expiry).toISOString() : null;
}

function normalizeOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AdminError('日期格式不正确');
  return date.toISOString();
}

function normalizeStringArray(value: unknown) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(item => String(item).trim()).filter(Boolean)));
}

function normalizeChoiceArray(value: unknown, allowed: string[]) {
  const values = normalizeStringArray(value).filter(item => allowed.includes(item));
  if (!values.length) throw new AdminError('请至少选择一个适用范围');
  return values;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
