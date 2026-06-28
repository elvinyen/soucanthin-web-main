import type { ApiRequest, ApiResponse, OrderRecord } from './_order-utils';
import { getOrderItems, getSupabaseConfig, markCouponUsed, notifyKitchenFromRecord, notifyStaffFromRecord, supabaseRequest } from './_order-utils';
import { parseJsonBody } from './_auth-utils';

type ReviewAction = 'approve' | 'reject';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const input = req.method === 'GET' ? parseQuery(req.url || '') : parseJsonBody<Record<string, string>>(req.body);
    const action = String(input.action || '') as ReviewAction;
    const orderId = String(input.id || input.orderId || '').trim();
    const reviewToken = String(input.token || '').trim();
    const adminToken = String(input.admin || input.adminToken || '').trim();

    if (!['approve', 'reject'].includes(action)) throw new Error('Invalid review action');
    if (!orderId || !reviewToken) throw new Error('Missing review token');
    if (!process.env.ADMIN_REVIEW_TOKEN || adminToken !== process.env.ADMIN_REVIEW_TOKEN) {
      throw new Error('Invalid admin token');
    }

    const order = action === 'approve'
      ? await approveOrderPayment(orderId, reviewToken)
      : await rejectOrderPayment(orderId, reviewToken);

    const message = action === 'approve'
      ? `订单 ${order.order_no} 的 Touch 'n Go eWallet 付款已通过`
      : `订单 ${order.order_no} 的 Touch 'n Go eWallet 付款已拒绝`;

    if (req.method === 'GET') {
      res.setHeader?.('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).end(renderResult(message));
    }

    return res.status(200).json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '审核失败';
    if (req.method === 'GET') {
      res.setHeader?.('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).end(renderResult(message));
    }
    return res.status(400).json({ success: false, error: message });
  }
}

async function approveOrderPayment(orderId: string, reviewToken: string) {
  const order = await findPendingTngOrder(orderId, reviewToken);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(orderId)}&payment_review_token=eq.${encodeURIComponent(reviewToken)}&payment_review_status=eq.pending`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'waiting_kitchen',
        payment_status: 'paid',
        payment_review_status: 'approved',
        paid_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      }),
    },
  );
  await markCouponUsed(order.coupon_id || undefined, order.user_id || undefined);
  const approvedOrder = await findOrderById(orderId);
  if (approvedOrder) {
    const items = await getOrderItems(approvedOrder.id);
    const notification = await notifyStaffFromRecord(approvedOrder, items);
    const kitchenNotification = await notifyKitchenFromRecord(approvedOrder, items);
    await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/orders?id=eq.${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          notification_status: notification.status,
          notified_at: notification.status === 'sent' ? new Date().toISOString() : null,
          telegram_chat_id: notification.chatId || null,
          telegram_message_id: notification.messageId || null,
          review_tg_chat_id: notification.chatId || null,
          review_tg_message_id: notification.messageId || null,
          kitchen_tg_chat_id: kitchenNotification.chatId || null,
          kitchen_tg_message_id: kitchenNotification.messageId || null,
        }),
      },
    );
  }
  return order;
}

async function rejectOrderPayment(orderId: string, reviewToken: string) {
  const order = await findPendingTngOrder(orderId, reviewToken);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(orderId)}&payment_review_token=eq.${encodeURIComponent(reviewToken)}&payment_review_status=eq.pending`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'cancelled',
        payment_review_status: 'rejected',
        reviewed_at: new Date().toISOString(),
      }),
    },
  );
  return order;
}

async function findOrderById(orderId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
    { method: 'GET' },
  );
  return Array.isArray(existing) ? existing[0] as OrderRecord | undefined : undefined;
}

async function findPendingTngOrder(orderId: string, reviewToken: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(orderId)}&payment_method=eq.tng&payment_review_token=eq.${encodeURIComponent(reviewToken)}&payment_review_status=eq.pending&select=id,order_no,user_id,coupon_id`,
    { method: 'GET' },
  );
  const order = Array.isArray(existing) ? existing[0] as {
    id: string;
    order_no: string;
    user_id?: string | null;
    coupon_id?: string | null;
  } | undefined : undefined;
  if (!order?.id) throw new Error("待审核 Touch 'n Go eWallet 订单不存在或已处理");
  return order;
}

function parseQuery(url: string) {
  const queryText = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  return Object.fromEntries(new URLSearchParams(queryText));
}

function renderResult(message: string) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Touch 'n Go eWallet 付款审核</title><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f4;color:#292524;display:grid;min-height:100vh;place-items:center;margin:0"><main style="background:white;border:1px solid #e7e5e4;border-radius:20px;padding:28px;max-width:360px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.08)"><h1 style="font-size:20px;margin:0 0 12px">Touch 'n Go eWallet 付款审核</h1><p style="margin:0;color:#78716c;line-height:1.6">${escapeHtml(message)}</p></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}
