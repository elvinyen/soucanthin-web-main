import { AdminError, enforceAdminBranch, hasAllBranchAccess, jsonError, parseAdminBody, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse, OrderItemRecord, OrderRecord } from './_order-utils';
import {
  editTelegramDeliveryMessage,
  editTelegramOrderMessage,
  getOrderItems,
  getSupabaseConfig,
  recordOrderStatusEvent,
  supabaseRequest,
} from './_order-utils';

type DeliveryProvider = 'in_house' | 'grab' | 'lalamove' | 'other';
type DeliveryTaskStatus = 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
type DeliveryAction = 'assign' | 'start' | 'deliver';

type DeliveryTaskRecord = {
  id: string;
  order_id: string;
  provider: DeliveryProvider;
  rider_name?: string | null;
  rider_phone?: string | null;
  external_order_no?: string | null;
  status: DeliveryTaskStatus;
  estimated_pickup_at?: string | null;
  estimated_delivery_at?: string | null;
  assigned_at: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  actual_delivery_cost: number;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

const ORDER_SELECT = [
  'id',
  'order_no',
  'order_type',
  'payment_method',
  'payment_status',
  'customer_name',
  'customer_phone',
  'delivery_address',
  'assigned_branch_id',
  'assigned_branch_name',
  'delivery_latitude',
  'delivery_longitude',
  'delivery_distance_km',
  'delivery_duration_min',
  'delivery_fee',
  'payable_total',
  'total',
  'note',
  'status',
  'created_at',
  'kitchen_completed_at',
  'last_status_changed_at',
  'telegram_chat_id',
  'telegram_message_id',
  'delivery_tg_chat_id',
  'delivery_tg_message_id',
].join(',');

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';

    if (method === 'GET') return await getDeliveryOrders(res, admin);
    if (method === 'POST' || method === 'PATCH') {
      const input = parseAdminBody<Record<string, unknown>>(req.body);
      const action = String(input.action || '') as DeliveryAction;
      if (action === 'assign') return await assignDelivery(res, admin, input);
      if (action === 'start') return await advanceDelivery(res, admin, input, 'start');
      if (action === 'deliver') return await advanceDelivery(res, admin, input, 'deliver');
      throw new AdminError('配送操作不正确');
    }

    res.setHeader?.('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getDeliveryOrders(res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const branch = hasAllBranchAccess(admin) ? '' : `assigned_branch_id=eq.${encodeURIComponent(enforceAdminBranch(admin) || '')}&`;
  const [orderRows, taskRows] = await Promise.all([
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/orders?${branch}order_type=eq.takeaway&status=in.(kitchen_done,delivering,delivered,completed)&select=${ORDER_SELECT}&order=created_at.desc&limit=100`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/delivery_tasks?select=*&order=updated_at.desc&limit=150',
      { method: 'GET' },
    ),
  ]);

  const orders = Array.isArray(orderRows) ? orderRows as OrderRecord[] : [];
  const tasks = Array.isArray(taskRows) ? taskRows as DeliveryTaskRecord[] : [];
  const itemsByOrderId = await getItemsByOrderId(orders.map(order => order.id));
  const taskByOrderId = new Map(tasks.map(task => [task.order_id, task]));

  return res.status(200).json({
    success: true,
    orders: orders.map(order => ({
      ...order,
      items: itemsByOrderId.get(order.id) || [],
      deliveryTask: taskByOrderId.get(order.id) || null,
    })),
    syncedAt: new Date().toISOString(),
  });
}

async function assignDelivery(
  res: ApiResponse,
  admin: Awaited<ReturnType<typeof requireAdminRole>>,
  input: Record<string, unknown>,
) {
  const order = await requireDeliveryOrder(String(input.orderId || ''), ['kitchen_done']);
  enforceAdminBranch(admin, order.assigned_branch_id);
  const provider = String(input.provider || '') as DeliveryProvider;
  if (!['in_house', 'grab', 'lalamove', 'other'].includes(provider)) throw new AdminError('请选择配送方式');

  const riderName = cleanText(input.riderName, 80);
  const riderPhone = cleanText(input.riderPhone, 30);
  const externalOrderNo = cleanText(input.externalOrderNo, 100);
  if (provider === 'in_house' && !riderName) throw new AdminError('店内配送需要填写配送员姓名');
  if (riderPhone && !/^[0-9+\-\s()]{7,30}$/.test(riderPhone)) throw new AdminError('配送员电话格式不正确');

  const estimatedPickupAt = optionalDate(input.estimatedPickupAt, '预计取餐时间');
  const estimatedDeliveryAt = optionalDate(input.estimatedDeliveryAt, '预计送达时间');
  if (estimatedPickupAt && estimatedDeliveryAt && estimatedDeliveryAt <= estimatedPickupAt) {
    throw new AdminError('预计送达时间必须晚于预计取餐时间');
  }
  const actualDeliveryCost = optionalMoney(input.actualDeliveryCost);
  const now = new Date().toISOString();
  const operatorName = admin.displayName || admin.username;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const existingRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/delivery_tasks?order_id=eq.${encodeURIComponent(order.id)}&select=*`,
    { method: 'GET' },
  );
  const existing = Array.isArray(existingRows) ? existingRows[0] as DeliveryTaskRecord | undefined : undefined;
  if (existing && !['assigned', 'cancelled'].includes(existing.status)) {
    throw new AdminError('配送已经开始，不能重新分配', 409);
  }

  const payload = {
    order_id: order.id,
    provider,
    rider_name: riderName || null,
    rider_phone: riderPhone || null,
    external_order_no: externalOrderNo || null,
    status: 'assigned',
    estimated_pickup_at: estimatedPickupAt?.toISOString() || null,
    estimated_delivery_at: estimatedDeliveryAt?.toISOString() || null,
    assigned_at: now,
    picked_up_at: null,
    delivered_at: null,
    cancelled_at: null,
    actual_delivery_cost: actualDeliveryCost,
    assigned_by: admin.id,
    assigned_by_name: operatorName,
    notes: cleanText(input.notes, 500) || null,
    updated_at: now,
  };

  const taskRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    '/delivery_tasks?on_conflict=order_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    },
  );
  const task = Array.isArray(taskRows) ? taskRows[0] : taskRows;
  return res.status(200).json({ success: true, task });
}

async function advanceDelivery(
  res: ApiResponse,
  admin: Awaited<ReturnType<typeof requireAdminRole>>,
  input: Record<string, unknown>,
  action: 'start' | 'deliver',
) {
  const orderId = String(input.orderId || '').trim();
  const fromStatus = action === 'start' ? 'kitchen_done' : 'delivering';
  const nextStatus = action === 'start' ? 'delivering' : 'delivered';
  const order = await requireDeliveryOrder(orderId, [fromStatus]);
  enforceAdminBranch(admin, order.assigned_branch_id);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const taskRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/delivery_tasks?order_id=eq.${encodeURIComponent(order.id)}&select=*`,
    { method: 'GET' },
  );
  const task = Array.isArray(taskRows) ? taskRows[0] as DeliveryTaskRecord | undefined : undefined;
  if (!task) throw new AdminError('请先安排配送', 409);
  if (action === 'start' && task.status !== 'assigned') throw new AdminError('当前配送任务不能开始配送', 409);
  if (action === 'deliver' && task.status !== 'picked_up') throw new AdminError('当前配送任务不能确认送达', 409);

  const now = new Date().toISOString();
  const operatorName = admin.displayName || admin.username;
  const updatedOrders = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(order.id)}&status=eq.${fromStatus}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: nextStatus,
        last_operator_telegram_user_id: `admin-web:${admin.id}`,
        last_operator_name: operatorName,
        last_status_changed_at: now,
      }),
    },
  );
  if (!Array.isArray(updatedOrders) || !updatedOrders[0]) throw new AdminError('订单状态已变化，请刷新后重试', 409);

  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/delivery_tasks?id=eq.${encodeURIComponent(task.id)}&status=eq.${task.status}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: action === 'start' ? 'picked_up' : 'delivered',
        ...(action === 'start' ? { picked_up_at: now } : { delivered_at: now }),
        updated_at: now,
      }),
    },
  );

  await recordOrderStatusEvent({
    orderId: order.id,
    orderNo: order.order_no,
    action: action === 'start' ? 'start_delivery' : 'delivered',
    fromStatus: order.status,
    toStatus: nextStatus,
    operatorTelegramUserId: `admin-web:${admin.id}`,
    operatorUsername: admin.username,
    operatorName,
  });

  const updatedOrder = updatedOrders[0] as OrderRecord;
  const items = await getOrderItems(order.id);
  await Promise.all([
    editTelegramOrderMessage(updatedOrder, items),
    editTelegramDeliveryMessage(updatedOrder, items),
  ]);
  return res.status(200).json({ success: true, status: nextStatus });
}

async function requireDeliveryOrder(orderId: string, allowedStatuses: string[]) {
  const id = orderId.trim();
  if (!id) throw new AdminError('缺少订单 ID');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?id=eq.${encodeURIComponent(id)}&order_type=eq.takeaway&select=*`,
    { method: 'GET' },
  );
  const order = Array.isArray(rows) ? rows[0] as OrderRecord | undefined : undefined;
  if (!order) throw new AdminError('外卖订单不存在', 404);
  if (!allowedStatuses.includes(order.status)) throw new AdminError('订单状态已变化，请刷新后重试', 409);
  return order;
}

async function getItemsByOrderId(orderIds: string[]) {
  const map = new Map<string, OrderItemRecord[]>();
  if (!orderIds.length) return map;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/order_items?order_id=in.(${orderIds.map(id => encodeURIComponent(id)).join(',')})&select=id,order_id,item_code,name,quantity,item_note&order=created_at.asc`,
    { method: 'GET' },
  );
  if (!Array.isArray(rows)) return map;
  rows.forEach(row => {
    const item = row as OrderItemRecord;
    const list = map.get(item.order_id) || [];
    list.push(item);
    map.set(item.order_id, list);
  });
  return map;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function optionalDate(value: unknown, label: string) {
  const text = cleanText(value, 40);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new AdminError(`${label}不正确`);
  return date;
}

function optionalMoney(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99999.99) throw new AdminError('配送成本不正确');
  return Math.round(amount * 100) / 100;
}
