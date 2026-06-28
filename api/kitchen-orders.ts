import {
  AdminError,
  jsonError,
  parseAdminBody,
  requireAdminRole,
} from './_admin-utils';
import type { ApiRequest, ApiResponse, OrderItemRecord, OrderRecord } from './_order-utils';
import {
  editTelegramKitchenMessage,
  editTelegramOrderMessage,
  getOrderItems,
  getSupabaseConfig,
  notifyDeliveryFromRecord,
  recordOrderStatusEvent,
  supabaseRequest,
} from './_order-utils';
import type { OrderStatus } from '../types/order';

type KitchenAction = 'start' | 'complete' | 'stock-issue';

type KitchenOrder = {
  id: string;
  orderNo: string;
  orderType: OrderRecord['order_type'];
  tableNo?: string | null;
  createdAt: string;
  status: OrderStatus;
  note?: string | null;
  kitchenStartedAt?: string | null;
  kitchenCompletedAt?: string | null;
  items: {
    id?: string;
    itemCode?: string | null;
    name: string;
    quantity: number;
    note?: string | null;
  }[];
};

const KITCHEN_ORDER_SELECT = [
  'id',
  'order_no',
  'order_type',
  'table_no',
  'note',
  'status',
  'created_at',
  'kitchen_started_at',
  'kitchen_completed_at',
  'telegram_chat_id',
  'telegram_message_id',
  'kitchen_tg_chat_id',
  'kitchen_tg_message_id',
  'review_tg_chat_id',
  'review_tg_message_id',
  'delivery_tg_chat_id',
  'delivery_tg_message_id',
].join(',');

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'kitchen']);
    const method = req.method || 'GET';
    const path = (req.url || '').split('?')[0];

    if (method === 'GET') {
      const payload = await getKitchenOrders();
      return res.status(200).json(payload);
    }

    if (method === 'POST') {
      if (path.endsWith('/start')) return updateKitchenOrder(req, res, admin, 'start');
      if (path.endsWith('/complete')) return updateKitchenOrder(req, res, admin, 'complete');
      if (path.endsWith('/stock-issue')) return updateKitchenOrder(req, res, admin, 'stock-issue');
    }

    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getKitchenOrders() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const [activeRows, doneRows] = await Promise.all([
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/orders?status=in.(waiting_kitchen,cooking)&select=${KITCHEN_ORDER_SELECT}&order=created_at.asc&limit=100`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/orders?status=eq.kitchen_done&select=${KITCHEN_ORDER_SELECT}&order=kitchen_completed_at.desc.nullslast,created_at.desc&limit=10`,
      { method: 'GET' },
    ),
  ]);
  const rows = [
    ...(Array.isArray(activeRows) ? activeRows as OrderRecord[] : []),
    ...(Array.isArray(doneRows) ? doneRows as OrderRecord[] : []),
  ];
  const itemsByOrderId = await getKitchenItems(rows.map(order => order.id));
  const orders = rows.map(order => mapKitchenOrder(order, itemsByOrderId.get(order.id) || []));
  return {
    success: true,
    orders,
    status: buildKitchenStatus(orders),
    syncedAt: new Date().toISOString(),
  };
}

async function getKitchenItems(orderIds: string[]) {
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  const itemsByOrderId = new Map<string, OrderItemRecord[]>();
  if (!ids.length) return itemsByOrderId;

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/order_items?order_id=in.(${ids.map(id => encodeURIComponent(id)).join(',')})&select=id,order_id,item_code,name,quantity,item_note&order=created_at.asc`,
    { method: 'GET' },
  );
  if (!Array.isArray(rows)) return itemsByOrderId;

  rows.forEach(row => {
    const item = row as OrderItemRecord;
    const list = itemsByOrderId.get(item.order_id) || [];
    list.push(item);
    itemsByOrderId.set(item.order_id, list);
  });
  return itemsByOrderId;
}

async function updateKitchenOrder(
  req: ApiRequest,
  res: ApiResponse,
  admin: { id: string; displayName: string; username: string },
  action: KitchenAction,
) {
  const input = parseAdminBody<{ id?: string }>(req.body);
  const id = String(input.id || '').trim();
  if (!id) throw new AdminError('缺少订单 ID');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: 'GET' },
  );
  const order = Array.isArray(rows) ? rows[0] as OrderRecord | undefined : undefined;
  if (!order?.id) throw new AdminError('订单不存在', 404);

  const transition = transitionFor(action, order.status);
  const now = new Date().toISOString();
  const operatorName = admin.displayName || admin.username;
  const patch = {
    status: transition.nextStatus,
    last_operator_telegram_user_id: `admin-web:${admin.id}`,
    last_operator_name: operatorName,
    last_status_changed_at: now,
    ...(action === 'start' ? { kitchen_started_at: now, kitchen_started_by: admin.id } : {}),
    ...(action === 'complete' ? { kitchen_completed_at: now, kitchen_completed_by: admin.id } : {}),
  };

  await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

  await recordOrderStatusEvent({
    orderId: order.id,
    orderNo: order.order_no,
    action: transition.eventAction,
    fromStatus: order.status,
    toStatus: transition.nextStatus,
    operatorTelegramUserId: `admin-web:${admin.id}`,
    operatorUsername: admin.username,
    operatorName,
  });

  const updatedRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: 'GET' },
  );
  const updatedOrder = Array.isArray(updatedRows) ? updatedRows[0] as OrderRecord | undefined : undefined;
  if (updatedOrder) {
    await editTelegramKitchenMessage(updatedOrder, transition.nextStatus as 'cooking' | 'kitchen_done' | 'stock_issue');
    const updatedItems = await getOrderItems(updatedOrder.id);
    await editTelegramOrderMessage(updatedOrder, updatedItems);
    if (transition.nextStatus === 'kitchen_done' && updatedOrder.order_type === 'takeaway' && !updatedOrder.delivery_tg_message_id) {
      const deliveryNotification = await notifyDeliveryFromRecord(updatedOrder, updatedItems);
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

  const items = updatedOrder ? await getOrderItems(updatedOrder.id) : [];
  return res.status(200).json({
    success: true,
    status: transition.nextStatus,
    order: updatedOrder ? mapKitchenOrder(updatedOrder, items) : null,
  });
}

function transitionFor(action: KitchenAction, currentStatus: OrderStatus) {
  if (action === 'start') {
    if (currentStatus !== 'waiting_kitchen') throw new AdminError('只有待制作订单可以开始制作', 409);
    return { nextStatus: 'cooking' as const, eventAction: 'kitchen_start' as const };
  }
  if (action === 'complete') {
    if (currentStatus !== 'cooking') throw new AdminError('只有制作中订单可以标记完成', 409);
    return { nextStatus: 'kitchen_done' as const, eventAction: 'kitchen_complete' as const };
  }
  if (currentStatus !== 'waiting_kitchen' && currentStatus !== 'cooking') {
    throw new AdminError('当前订单不能标记缺货', 409);
  }
  return { nextStatus: 'stock_issue' as const, eventAction: 'stock_issue' as const };
}

function mapKitchenOrder(order: OrderRecord, items: OrderItemRecord[]): KitchenOrder {
  return {
    id: order.id,
    orderNo: order.order_no,
    orderType: order.order_type,
    tableNo: order.table_no,
    createdAt: order.created_at,
    status: order.status,
    note: order.note,
    kitchenStartedAt: order.kitchen_started_at,
    kitchenCompletedAt: order.kitchen_completed_at,
    items: items.map(item => ({
      id: item.id,
      itemCode: item.item_code,
      name: item.name,
      quantity: Number(item.quantity),
      note: item.item_note,
    })),
  };
}

function buildKitchenStatus(orders: KitchenOrder[]) {
  return {
    waiting: orders.filter(order => order.status === 'waiting_kitchen').length,
    cooking: orders.filter(order => order.status === 'cooking').length,
    completed: orders.filter(order => order.status === 'kitchen_done').length,
  };
}
