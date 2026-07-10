import { getAuthenticatedUser } from './_auth-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, parseOrderBody, releaseCoupon, supabaseRequest } from './_order-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ success: false, error: '请先登录' });
    const body = parseOrderBody(req.body) as unknown as { orderNo?: string };
    const orderNo = String(body.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ success: false, error: '缺少订单号' });
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/orders?order_no=eq.${encodeURIComponent(orderNo)}&user_id=eq.${encodeURIComponent(user.id)}&payment_method=eq.stripe&payment_status=eq.awaiting_payment&select=id,user_id,coupon_id`,
      { method: 'GET' },
    );
    const order = Array.isArray(rows) ? rows[0] as { id: string; user_id?: string | null; coupon_id?: string | null } | undefined : undefined;
    if (!order) return res.status(200).json({ success: true });
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=eq.${encodeURIComponent(order.id)}&payment_status=eq.awaiting_payment`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', coupon_status: order.coupon_id ? 'released' : null }),
    });
    await releaseCoupon(order.coupon_id || undefined, user.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '订单取消失败' });
  }
}
