import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdmin } from './_admin-utils';
import type { ApiRequest, ApiResponse, OrderRecord } from './_order-utils';
import { editTelegramOrderMessage, getOrderItems, getSupabaseConfig, isOrderStatus, recordOrderStatusEvent, supabaseRequest } from './_order-utils';
import type { OrderStatus } from '../types/order';

const ORDER_SELECT = 'id,order_no,user_id,order_type,payment_method,customer_name,customer_phone,table_no,delivery_address,note,subtotal,delivery_fee,service_charge,total,discount_amount,payable_total,status,payment_status,payment_review_status,receipt_url,notification_status,telegram_chat_id,telegram_message_id,created_at,last_status_changed_at,last_operator_name';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    await requireAdmin(req);
    const method = req.method || 'GET';

    if (method === 'GET') return getOrders(req, res);
    if (method === 'PATCH' || method === 'PUT') return updateOrderStatus(req, res);

    res.setHeader?.('Allow', 'GET, PATCH, PUT');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getOrders(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const id = query.get('id')?.trim();
  const status = query.get('status')?.trim();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  if (id) {
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/orders?id=eq.${encodeURIComponent(id)}&select=${ORDER_SELECT}`,
      { method: 'GET' },
    );
    const order = Array.isArray(rows) ? rows[0] as OrderRecord | undefined : undefined;
    if (!order) throw new AdminError('订单不存在', 404);
    const items = await getOrderItems(order.id);
    return res.status(200).json({ success: true, order, items });
  }

  const filters = [`select=${ORDER_SELECT}`, 'order=created_at.desc', 'limit=80'];
  if (status && status !== 'all') filters.push(`status=eq.${encodeURIComponent(status)}`);

  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?${filters.join('&')}`,
    { method: 'GET' },
  );

  return res.status(200).json({ success: true, orders: Array.isArray(rows) ? rows : [] });
}

async function updateOrderStatus(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<{ id?: string; status?: OrderStatus }>(req.body);
  const id = String(input.id || parseQuery(req.url).get('id') || '').trim();
  const nextStatus = String(input.status || '').trim();

  if (!id) throw new AdminError('缺少订单 ID');
  if (!isOrderStatus(nextStatus)) throw new AdminError('订单状态不正确');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: 'GET' },
  );
  const order = Array.isArray(rows) ? rows[0] as OrderRecord | undefined : undefined;
  if (!order) throw new AdminError('订单不存在', 404);

  await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: nextStatus,
      last_operator_name: '后台管理',
      last_status_changed_at: new Date().toISOString(),
    }),
  });

  await recordOrderStatusEvent({
    orderId: order.id,
    orderNo: order.order_no,
    action: actionForStatus(nextStatus),
    fromStatus: order.status,
    toStatus: nextStatus,
    operatorTelegramUserId: 'admin-web',
    operatorName: '后台管理',
  });

  const updatedRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: 'GET' },
  );
  const updatedOrder = Array.isArray(updatedRows) ? updatedRows[0] as OrderRecord | undefined : undefined;
  if (updatedOrder) {
    const items = await getOrderItems(updatedOrder.id);
    await editTelegramOrderMessage(updatedOrder, items);
  }

  return res.status(200).json({ success: true, status: nextStatus });
}

function actionForStatus(status: OrderStatus) {
  if (status === 'preparing') return 'confirm';
  if (status === 'delivering') return 'start_delivery';
  if (status === 'delivered') return 'delivered';
  if (status === 'completed') return 'complete';
  return 'cancel';
}
