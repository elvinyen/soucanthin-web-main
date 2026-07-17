import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse, OrderRecord } from './_order-utils';
import {
  createOrderWithItems,
  editTelegramDeliveryMessage,
  editTelegramOrderMessage,
  generateOrderId,
  getOrderItems,
  getSupabaseConfig,
  isOrderStatus,
  notifyDeliveryFromRecord,
  notifyKitchenFromRecord,
  notifyStaffFromOrder,
  recordOrderStatusEvent,
  releaseCoupon,
  supabaseRequest,
  uploadReceipt,
  updateOrderById,
  validateMenuItemsAvailable,
  validateOrder,
  validateReceiptImage,
} from './_order-utils';
import { attributeOrderToAgent, syncOrderCommissionStatus } from './_agent-utils';
import { applyDeliveryQuoteToOrder } from './_delivery-utils';
import type { Order, OrderStatus, ReceiptImage } from '../types/order';

type AdminOrderInput = {
  customerId?: string;
  order?: Order;
};

type AdminContext = {
  id: string;
  displayName: string;
  username: string;
  role: 'admin' | 'owner' | 'manager' | 'staff' | 'customer_service' | 'kitchen' | 'delivery';
};

type OrderChangeRecord = {
  id: string;
  order_id: string;
  order_no: string;
  change_type: 'payment_method';
  action: 'submitted' | 'approved' | 'rejected';
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  reason?: string | null;
  related_event_id?: string | null;
  created_by_admin_id?: string | null;
  operator_name: string;
  created_at: string;
};

const ORDER_SELECT = 'id,order_no,order_source,created_by_admin_id,user_id,order_type,payment_method,customer_name,customer_phone,table_no,delivery_address,assigned_branch_id,assigned_branch_name,delivery_latitude,delivery_longitude,delivery_distance_km,delivery_duration_min,delivery_quote_provider,note,subtotal,delivery_fee,service_charge,total,discount_amount,payable_total,status,payment_status,payment_review_status,receipt_url,notification_status,telegram_chat_id,telegram_message_id,review_tg_chat_id,review_tg_message_id,kitchen_tg_chat_id,kitchen_tg_message_id,delivery_tg_chat_id,delivery_tg_message_id,created_at,last_status_changed_at,last_operator_name';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';

    if (method === 'GET') return await getOrders(req, res);
    if (method === 'POST') return await createAdminOrder(req, res, admin);
    if (method === 'PATCH' || method === 'PUT') return await updateAdminOrder(req, res, admin);

    res.setHeader?.('Allow', 'GET, POST, PATCH, PUT');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function createAdminOrder(req: ApiRequest, res: ApiResponse, admin: AdminContext) {
  const input = parseAdminBody<AdminOrderInput>(req.body);
  const customerId = String(input.customerId || '').trim();
  const order = input.order;

  if (!customerId) throw new AdminError('请选择顾客');
  if (!order || typeof order !== 'object') throw new AdminError('订单内容不能为空');
  if (order.paymentMethod !== 'cash') throw new AdminError('后台代客下单目前只支持现金/到店支付');

  const customer = await findCustomerById(customerId);
  if (!customer) throw new AdminError('顾客不存在', 404);
  const branchId = String(order.assignedBranch?.id || order.deliveryQuote?.branchId || '').trim();
  if (!branchId) throw new AdminError('请选择门店');
  const branch = await findActiveBranchById(branchId);
  if (!branch) throw new AdminError('所选门店不可用或未启用', 404);

  order.userId = customer.id;
  order.paymentMethod = 'cash';
  order.assignedBranch = {
    id: branch.id,
    name: branch.name,
  };
  order.customer = {
    name: String(customer.name || order.customer?.name || '顾客').trim(),
    phone: customer.display_phone || customer.phone,
  };
  order.couponId = undefined;
  order.discountAmount = 0;
  order.payableTotal = undefined;
  order.createdAt = order.createdAt || new Date().toISOString();

  const validationError = validateOrder(order, ['cash']);
  if (validationError) throw new AdminError(validationError);

  const availabilityError = await validateMenuItemsAvailable(order);
  if (availabilityError) throw new AdminError(availabilityError);

  await applyDeliveryQuoteToOrder(order);

  const orderNo = generateOrderId();
  const status: OrderStatus = 'waiting_kitchen';
  const paymentStatus = 'pay_at_counter';
  const paymentReviewStatus = 'not_required';

  const { orderRecord } = await createOrderWithItems({
    order,
    orderNo,
    orderSource: 'admin_created',
    createdByAdminId: admin.id,
    status,
    paymentStatus,
    paymentReviewStatus,
    discountAmount: 0,
  });
  await attributeOrderToAgent({
    orderId: orderRecord.id,
    userId: customer.id,
    subtotal: Number(orderRecord.subtotal || 0),
    discountAmount: 0,
  });
  const items = await getOrderItems(orderRecord.id);

  await recordOrderStatusEvent({
    orderId: orderRecord.id,
    orderNo: orderRecord.order_no,
    action: 'send_to_kitchen',
    fromStatus: 'pending_confirm',
    toStatus: status,
    operatorTelegramUserId: `admin-web:${admin.id}`,
    operatorUsername: admin.username,
    operatorName: admin.displayName || admin.username,
  });

  const notification = await notifyStaffFromOrder(order, orderNo, {
    status,
    payment_status: paymentStatus,
    payment_review_status: paymentReviewStatus,
    created_at: orderRecord.created_at,
  });
  const kitchenNotification = await notifyKitchenFromRecord(orderRecord, items);

  await updateOrderById(orderRecord.id, {
    notification_status: notification.status,
    notified_at: notification.status === 'sent' ? new Date().toISOString() : null,
    telegram_chat_id: notification.chatId || null,
    telegram_message_id: notification.messageId || null,
    review_tg_chat_id: notification.chatId || null,
    review_tg_message_id: notification.messageId || null,
    kitchen_tg_chat_id: kitchenNotification.chatId || null,
    kitchen_tg_message_id: kitchenNotification.messageId || null,
    last_operator_name: admin.displayName || admin.username,
    last_status_changed_at: new Date().toISOString(),
  });

  return res.status(201).json({
    success: true,
    orderId: orderNo,
    order: {
      ...orderRecord,
      notification_status: notification.status,
      kitchen_tg_chat_id: kitchenNotification.chatId || null,
      kitchen_tg_message_id: kitchenNotification.messageId || null,
    },
  });
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
    const changes = await getOrderChanges(order.id);
    return res.status(200).json({ success: true, order, items, changes });
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

async function updateAdminOrder(req: ApiRequest, res: ApiResponse, admin: AdminContext) {
  const input = parseAdminBody<{ action?: string }>(req.body);
  if (input.action === 'change_payment_method') return submitPaymentMethodChange(req, res, admin);
  if (input.action === 'review_payment_change') return reviewPaymentMethodChange(req, res, admin);
  return updateOrderStatus(req, res, admin);
}

async function updateOrderStatus(req: ApiRequest, res: ApiResponse, admin: AdminContext) {
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
      last_operator_name: admin.displayName || admin.username,
      last_status_changed_at: new Date().toISOString(),
    }),
  });
  await syncOrderCommissionStatus(id, nextStatus);
  if (nextStatus === 'cancelled') {
    await releaseCoupon(order.coupon_id || undefined, order.user_id || undefined);
    await updateOrderById(order.id, { coupon_status: order.coupon_id ? 'released' : null });
  }

  await recordOrderStatusEvent({
    orderId: order.id,
    orderNo: order.order_no,
    action: actionForStatus(nextStatus),
    fromStatus: order.status,
    toStatus: nextStatus,
    operatorTelegramUserId: `admin-web:${admin.id}`,
    operatorUsername: admin.username,
    operatorName: admin.displayName || admin.username,
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
    if (updatedOrder.order_type === 'takeaway' && ['kitchen_done', 'delivering', 'delivered', 'completed'].includes(updatedOrder.status)) {
      if (updatedOrder.delivery_tg_message_id) {
        await editTelegramDeliveryMessage(updatedOrder, items);
      } else {
        const deliveryNotification = await notifyDeliveryFromRecord(updatedOrder, items);
        if (deliveryNotification.messageId) {
          await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              delivery_tg_chat_id: deliveryNotification.chatId || null,
              delivery_tg_message_id: deliveryNotification.messageId || null,
            }),
          });
        }
      }
    }
  }

  return res.status(200).json({ success: true, status: nextStatus });
}

async function submitPaymentMethodChange(req: ApiRequest, res: ApiResponse, admin: AdminContext) {
  const input = parseAdminBody<{
    id?: string;
    paymentMethod?: string;
    reason?: string;
    receiptImage?: ReceiptImage;
  }>(req.body);
  const id = String(input.id || parseQuery(req.url).get('id') || '').trim();
  const reason = String(input.reason || '').trim();

  if (!id) throw new AdminError('缺少订单 ID');
  if (input.paymentMethod !== 'tng') throw new AdminError('目前只支持更正为 Touch \'n Go 转账');
  if (reason.length < 2) throw new AdminError('请填写修改原因');
  const receiptError = validateReceiptImage(input.receiptImage);
  if (receiptError) throw new AdminError(receiptError);

  const order = await findOrderById(id);
  if (!order) throw new AdminError('订单不存在', 404);
  validatePaymentChangeOrder(order);

  const receiptUrl = await uploadReceipt(order.order_no, input.receiptImage!);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const eventId = await callOrderChangeRpc(
    supabaseUrl,
    serviceRoleKey,
    '/rpc/submit_order_payment_change',
    {
      order_id_input: order.id,
      receipt_url_input: receiptUrl,
      reason_input: reason,
      admin_id_input: admin.id,
      admin_name_input: admin.displayName || admin.username,
    },
  );

  const updatedOrder = await findOrderById(id);
  if (updatedOrder) await editTelegramOrderMessage(updatedOrder, await getOrderItems(updatedOrder.id));
  return res.status(200).json({ success: true, eventId, order: updatedOrder });
}

async function reviewPaymentMethodChange(req: ApiRequest, res: ApiResponse, admin: AdminContext) {
  if (admin.role !== 'admin' && admin.role !== 'owner') throw new AdminError('只有管理员或老板可以审核付款截图', 403);
  const input = parseAdminBody<{
    id?: string;
    changeId?: string;
    decision?: 'approve' | 'reject';
    reason?: string;
  }>(req.body);
  const id = String(input.id || parseQuery(req.url).get('id') || '').trim();
  const changeId = String(input.changeId || '').trim();
  const decision = input.decision;
  const reason = String(input.reason || '').trim();

  if (!id || !changeId) throw new AdminError('缺少付款修改记录');
  if (decision !== 'approve' && decision !== 'reject') throw new AdminError('审核操作不正确');
  if (decision === 'reject' && reason.length < 2) throw new AdminError('请填写拒绝原因');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const eventId = await callOrderChangeRpc(
    supabaseUrl,
    serviceRoleKey,
    '/rpc/review_order_payment_change',
    {
      order_id_input: id,
      submitted_event_id_input: changeId,
      decision_input: decision,
      reason_input: reason || null,
      admin_id_input: admin.id,
      admin_name_input: admin.displayName || admin.username,
    },
  );

  const updatedOrder = await findOrderById(id);
  if (updatedOrder) await editTelegramOrderMessage(updatedOrder, await getOrderItems(updatedOrder.id));
  return res.status(200).json({ success: true, eventId, order: updatedOrder });
}

async function findOrderById(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] as OrderRecord | undefined : undefined;
}

async function getOrderChanges(orderId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/order_change_events?order_id=eq.${encodeURIComponent(orderId)}&select=*&order=created_at.desc`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows as OrderChangeRecord[] : [];
}

async function callOrderChangeRpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  body: Record<string, unknown>,
) {
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (typeof result === 'string') return result;
  if (Array.isArray(result) && typeof result[0] === 'string') return result[0];
  throw new AdminError('订单修改记录写入失败', 500);
}

function validatePaymentChangeOrder(order: OrderRecord) {
  if (order.order_source !== 'admin_created') throw new AdminError('只有后台代下单可以更正支付方式');
  if (order.status === 'completed' || order.status === 'cancelled') throw new AdminError('已完成或已取消订单不能修改支付方式');
  if (order.payment_method !== 'cash' || order.payment_status !== 'pay_at_counter') {
    throw new AdminError('当前付款状态不允许更正为转账');
  }
}

async function findCustomerById(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/users?id=eq.${encodeURIComponent(id)}&select=id,phone,display_phone,name`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] as { id: string; phone: string; display_phone: string; name?: string | null } | undefined : undefined;
}

async function findActiveBranchById(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?id=eq.${encodeURIComponent(id)}&active=eq.true&select=id,name`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] as { id: string; name: string } | undefined : undefined;
}

function actionForStatus(status: OrderStatus) {
  if (status === 'waiting_kitchen') return 'send_to_kitchen';
  if (status === 'cooking') return 'kitchen_start';
  if (status === 'kitchen_done') return 'kitchen_complete';
  if (status === 'stock_issue') return 'stock_issue';
  if (status === 'preparing') return 'confirm';
  if (status === 'delivering') return 'start_delivery';
  if (status === 'delivered') return 'delivered';
  if (status === 'completed') return 'complete';
  return 'cancel';
}
