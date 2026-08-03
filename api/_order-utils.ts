import type { Order, OrderStatus, OrderType, PaymentMethod, ReceiptImage } from '../types/order';

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string | string[]) => void;
  end?: (body?: unknown) => void;
};

export type ApiRequest = {
  method?: string;
  url?: string;
  originalUrl?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string | null };
  on?: (event: string, callback: (chunk?: Buffer) => void) => void;
};

export type NotificationStatus = 'sent' | 'failed';
export type PaymentStatus = 'pay_at_counter' | 'pending_review' | 'awaiting_payment' | 'paid';
export type PaymentReviewStatus = 'not_required' | 'pending' | 'approved' | 'rejected';
export type TelegramOrderAction =
  | 'send_to_kitchen'
  | 'kitchen_start'
  | 'kitchen_complete'
  | 'stock_issue'
  | 'confirm'
  | 'start_delivery'
  | 'delivered'
  | 'complete'
  | 'cancel';

export type TelegramNotificationResult = {
  status: NotificationStatus;
  chatId?: string;
  messageId?: number;
};

type TelegramSendResult = {
  ok: boolean;
  chatId?: string;
  messageId?: number;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: {
    text: string;
    callback_data: string;
  }[][];
};

export type OrderRecord = {
  id: string;
  order_no: string;
  order_source?: 'web' | 'admin_created';
  created_by_admin_id?: string | null;
  user_id?: string | null;
  order_type: OrderType;
  payment_method: PaymentMethod;
  customer_name: string;
  customer_phone: string;
  table_no?: string | null;
  delivery_address?: string | null;
  assigned_branch_id?: string | null;
  assigned_branch_name?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_distance_km?: number | null;
  delivery_duration_min?: number | null;
  delivery_quote_provider?: string | null;
  note?: string | null;
  subtotal: number;
  delivery_fee?: number;
  service_charge: number;
  total: number;
  discount_amount?: number;
  payable_total?: number;
  coupon_id?: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_review_status: PaymentReviewStatus;
  receipt_url?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  payment_review_token?: string | null;
  reviewed_at?: string | null;
  notification_status: NotificationStatus | 'pending';
  telegram_chat_id?: string | null;
  telegram_message_id?: number | null;
  review_tg_chat_id?: string | null;
  review_tg_message_id?: number | null;
  kitchen_tg_chat_id?: string | null;
  kitchen_tg_message_id?: number | null;
  delivery_tg_chat_id?: string | null;
  delivery_tg_message_id?: number | null;
  last_operator_telegram_user_id?: string | null;
  last_operator_name?: string | null;
  last_status_changed_at?: string | null;
  kitchen_started_at?: string | null;
  kitchen_completed_at?: string | null;
  kitchen_started_by?: string | null;
  kitchen_completed_by?: string | null;
  created_at: string;
};

export type OrderItemRecord = {
  id?: string;
  order_id: string;
  menu_item_id: string;
  item_code?: string | null;
  name: string;
  unit_base_price?: number;
  unit_options_total?: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  selected_options?: Order['items'][number]['options'];
  item_note?: string | null;
};

const ORDER_TYPES: OrderType[] = ['dinein', 'takeaway'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'tng', 'stripe', 'wallet'];
export function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    supabaseUrl.includes('your-project.supabase.co') ||
    serviceRoleKey.includes('your-service-role-key')
  ) {
    throw new Error('Supabase is not configured');
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
  };
}

export function supabaseAuthHeaders(serviceRoleKey: string) {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
  };

  if (isJwtLikeKey(serviceRoleKey)) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  return headers;
}

function isJwtLikeKey(key: string) {
  return key.split('.').length >= 3;
}

export function parseOrderBody(body: unknown) {
  if (!body) throw new Error('Order payload is required');
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as Order;
  if (typeof body === 'string') return JSON.parse(body) as Order;
  return body as Order;
}

export function validateOrder(order: Order | undefined, allowedPaymentMethods = PAYMENT_METHODS) {
  if (!order || typeof order !== 'object') return 'Order payload is required';
  if (!ORDER_TYPES.includes(order.orderType)) return 'Invalid order type';
  if (!allowedPaymentMethods.includes(order.paymentMethod)) return 'Invalid payment method';
  if (!order.customer?.name?.trim()) return 'Customer name is required';
  if (!order.customer?.phone?.trim()) return 'Customer phone is required';
  if (!/^[0-9+\-\s()]{8,20}$/.test(order.customer.phone.trim())) return 'Customer phone is invalid';
  if (order.orderType === 'dinein' && !order.dineIn?.tableNo?.trim()) return 'Table number is required';
  if (order.orderType === 'takeaway' && !order.takeaway?.address?.trim()) return 'Delivery address is required';
  if (!Array.isArray(order.items) || order.items.length === 0) return 'At least one item is required';

  const invalidItem = order.items.find(item =>
    !item.id ||
    !item.name?.trim() ||
    !Number.isFinite(item.price) ||
    item.price <= 0 ||
    (item.basePrice !== undefined && (!Number.isFinite(item.basePrice) || item.basePrice < 0)) ||
    (item.optionsTotal !== undefined && (!Number.isFinite(item.optionsTotal) || item.optionsTotal < 0)) ||
    !Number.isInteger(item.qty) ||
    item.qty <= 0
  );

  if (invalidItem) return 'Order items are invalid';
  if (order.paymentMethod === 'tng') return validateReceiptImage(order.receiptImage);
  return '';
}

export function validateReceiptImage(receiptImage?: ReceiptImage) {
  if (!receiptImage) return "Touch 'n Go eWallet receipt image is required";
  if (!receiptImage.fileName?.trim()) return 'Receipt file name is required';
  if (!['image/jpeg', 'image/png'].includes(receiptImage.mimeType)) {
    return 'Receipt must be a JPG or PNG image';
  }

  const byteLength = Buffer.byteLength(receiptImage.dataBase64 || '', 'base64');
  if (!receiptImage.dataBase64 || byteLength === 0) return 'Receipt image is empty';
  if (byteLength > 5 * 1024 * 1024) return 'Receipt image must be under 5MB';

  return '';
}

export async function validateMenuItemsAvailable(order: Order) {
  const rawItemIds = order.items.map(item => Number(item.id));
  if (rawItemIds.some(id => !Number.isInteger(id) || id <= 0)) return 'Order items are invalid';
  const itemIds = Array.from(new Set(rawItemIds));

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?id=in.(${itemIds.map(id => encodeURIComponent(String(id))).join(',')})&select=id,item_code,name,price,active,sold_out,option_groups`,
    { method: 'GET' },
  );
  const itemsById = new Map(
    (Array.isArray(rows) ? rows : []).map(row => {
      const item = row as {
        id?: number;
        item_code?: string | null;
        name?: string;
        price?: number;
        active?: boolean | null;
        sold_out?: boolean | null;
        option_groups?: Array<{
          id: string;
          name: string;
          required?: boolean;
          type?: 'single' | 'multiple';
          options?: Array<{ id: string; name: string; priceDelta: number }>;
        }> | null;
      };
      return [Number(item.id), item];
    }),
  );
  const unavailable = itemIds
    .map(id => itemsById.get(id))
    .find(item => !item || item.active === false || item.sold_out === true);

  if (unavailable) {
    return unavailable.sold_out ? `「${unavailable.name || '菜品'}」已售罄，请从购物车移除后再下单` : `「${unavailable.name || '菜品'}」已下架，请从购物车移除后再下单`;
  }

  for (const orderItem of order.items) {
    const menuItem = itemsById.get(Number(orderItem.id));
    if (!menuItem) return '订单中包含不存在的菜品';
    const optionGroups = Array.isArray(menuItem.option_groups) ? menuItem.option_groups : [];
    const selectedOptions = Array.isArray(orderItem.options) ? orderItem.options : [];
    const normalizedOptions: NonNullable<Order['items'][number]['options']> = [];
    for (const selected of selectedOptions) {
      const group = optionGroups.find(candidate => candidate.id === selected.groupId);
      const option = group?.options?.find(candidate => candidate.id === selected.optionId);
      if (!group || !option) return `「${menuItem.name || '菜品'}」包含无效选项，请重新选择`;
      normalizedOptions.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        name: option.name,
        priceDelta: roundMoney(Number(option.priceDelta || 0)),
      });
    }
    for (const group of optionGroups) {
      const groupSelections = normalizedOptions.filter(option => option.groupId === group.id);
      if (group.required && groupSelections.length === 0) return `「${menuItem.name || '菜品'}」请选择${group.name}`;
      if (group.type === 'single' && groupSelections.length > 1) return `「${menuItem.name || '菜品'}」的${group.name}只能选择一项`;
    }
    const basePrice = roundMoney(Number(menuItem.price || 0));
    const optionsTotal = roundMoney(normalizedOptions.reduce((sum, option) => sum + option.priceDelta, 0));
    orderItem.code = menuItem.item_code || undefined;
    orderItem.name = menuItem.name || orderItem.name;
    orderItem.basePrice = basePrice;
    orderItem.optionsTotal = optionsTotal;
    orderItem.options = normalizedOptions;
    orderItem.price = roundMoney(basePrice + optionsTotal);
  }
  return '';
}

export function calculateTotals(order: Order) {
  const subtotal = roundMoney(order.items.reduce((sum, item) => sum + item.price * item.qty, 0));
  const deliveryFee = order.orderType === 'takeaway' ? roundMoney(Math.max(Number(order.deliveryFee || 0), 0)) : 0;
  const serviceCharge = 0;
  const total = roundMoney(subtotal + deliveryFee + serviceCharge);
  const discountAmount = roundMoney(Math.min(Math.max(Number(order.discountAmount || 0), 0), total));
  const payableTotal = roundMoney(Math.max(total - discountAmount, 0));
  return { subtotal, deliveryFee, serviceCharge, total, discountAmount, payableTotal };
}

export async function createOrderWithItems(params: {
  order: Order;
  orderNo: string;
  orderSource?: 'web' | 'admin_created';
  createdByAdminId?: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentReviewStatus: PaymentReviewStatus;
  receiptUrl?: string | null;
  stripeCheckoutSessionId?: string | null;
  discountAmount?: number;
  paymentReviewToken?: string | null;
}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const nextOrder = { ...params.order, discountAmount: params.discountAmount ?? params.order.discountAmount ?? 0 };
  const { subtotal, deliveryFee, serviceCharge, total, discountAmount, payableTotal } = calculateTotals(nextOrder);
  const createdAt = params.order.createdAt || new Date().toISOString();

  const orderRecord = await insertOrder(supabaseUrl, serviceRoleKey, {
    order_no: params.orderNo,
    order_source: params.orderSource || 'web',
    created_by_admin_id: params.createdByAdminId || null,
    user_id: params.order.userId || null,
    order_type: params.order.orderType,
    payment_method: params.order.paymentMethod,
    customer_name: params.order.customer.name.trim(),
    customer_phone: params.order.customer.phone.trim(),
    table_no: params.order.orderType === 'dinein' ? params.order.dineIn?.tableNo.trim() : null,
    delivery_address: params.order.orderType === 'takeaway' ? params.order.takeaway?.address.trim() : null,
    assigned_branch_id: params.order.assignedBranch?.id || (params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.branchId : null) || null,
    assigned_branch_name: params.order.assignedBranch?.name || (params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.branchName : null) || null,
    delivery_latitude: params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.addressLatitude ?? null : null,
    delivery_longitude: params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.addressLongitude ?? null : null,
    delivery_distance_km: params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.distanceKm ?? null : null,
    delivery_duration_min: params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.durationMin ?? null : null,
    delivery_quote_provider: params.order.orderType === 'takeaway' ? params.order.deliveryQuote?.provider || null : null,
    delivery_quote_id: params.order.orderType === 'takeaway' ? params.order.deliveryQuoteId || null : null,
    delivery_approval_request_id: params.order.orderType === 'takeaway' ? params.order.deliveryApprovalRequestId || null : null,
    note: params.order.note?.trim() || null,
    subtotal,
    delivery_fee: deliveryFee,
    service_charge: serviceCharge,
    total,
    coupon_id: params.order.couponId || null,
    coupon_code: params.order.couponSnapshot?.code || null,
    coupon_title: params.order.couponSnapshot?.title || null,
    coupon_discount_type: params.order.couponSnapshot?.discountType || null,
    coupon_discount_value: params.order.couponSnapshot?.discountValue ?? null,
    coupon_rule_snapshot: params.order.couponSnapshot || null,
    coupon_status: params.order.couponId ? 'reserved' : null,
    discount_amount: discountAmount,
    payable_total: payableTotal,
    status: params.status,
    payment_status: params.paymentStatus,
    payment_review_status: params.paymentReviewStatus,
    payment_review_token: params.paymentReviewToken || null,
    receipt_url: params.receiptUrl || null,
    stripe_checkout_session_id: params.stripeCheckoutSessionId || null,
    notification_status: 'pending',
    created_at: createdAt,
    source_payload: {
      ...params.order,
      deliveryQuoteToken: undefined,
      deliveryFee,
      deliveryQuote: params.order.deliveryQuote,
      discountAmount,
      payableTotal,
      receiptImage: params.order.receiptImage ? {
        fileName: params.order.receiptImage.fileName,
        mimeType: params.order.receiptImage.mimeType,
        storedIn: 'payment-receipts',
      } : undefined,
    },
  });

  await insertOrderItems(supabaseUrl, serviceRoleKey, params.order.items.map(item => ({
    order_id: orderRecord.id,
    menu_item_id: item.id,
    item_code: item.code || null,
    name: item.name,
    unit_base_price: roundMoney(item.basePrice ?? item.price),
    unit_options_total: roundMoney(item.optionsTotal ?? 0),
    unit_price: roundMoney(item.price),
    quantity: item.qty,
    line_total: roundMoney(item.price * item.qty),
    selected_options: item.options || [],
    item_note: item.note?.trim() || null,
  })));

  return { orderRecord, subtotal, deliveryFee, serviceCharge, total, discountAmount, payableTotal };
}

export async function insertOrder(supabaseUrl: string, serviceRoleKey: string, payload: Record<string, unknown>) {
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  const record = Array.isArray(result) ? result[0] : null;
  if (!record?.id) throw new Error('Order was not saved');
  return record as OrderRecord;
}

export async function insertOrderItems(supabaseUrl: string, serviceRoleKey: string, payload: OrderItemRecord[]) {
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/order_items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrderById(orderRecordId: string, payload: Record<string, unknown>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=eq.${encodeURIComponent(orderRecordId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (payload.status === 'completed' || payload.status === 'cancelled') {
    const { syncOrderCommissionStatus } = await import('./_agent-utils');
    await syncOrderCommissionStatus(orderRecordId, String(payload.status));
  }
}

export async function updateOrderByNo(orderNo: string, payload: Record<string, unknown>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?order_no=eq.${encodeURIComponent(orderNo)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function recordOrderStatusEvent(params: {
  orderId: string;
  orderNo: string;
  action: TelegramOrderAction;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  operatorTelegramUserId: string;
  operatorUsername?: string | null;
  operatorName?: string | null;
}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/order_status_events', {
    method: 'POST',
    body: JSON.stringify({
      order_id: params.orderId,
      order_no: params.orderNo,
      action: params.action,
      from_status: params.fromStatus,
      to_status: params.toStatus,
      operator_telegram_user_id: params.operatorTelegramUserId,
      operator_username: params.operatorUsername || null,
      operator_name: params.operatorName || null,
    }),
  });
}

export async function updateOrderByStripeSession(sessionId: string, payload: Record<string, unknown>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function findOrderByStripeSession(sessionId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
    { method: 'GET' },
  );

  return Array.isArray(result) ? result[0] as OrderRecord | undefined : undefined;
}

export async function findOrderByNo(orderNo: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/orders?order_no=eq.${encodeURIComponent(orderNo)}&select=*`,
    { method: 'GET' },
  );

  return Array.isArray(result) ? result[0] as OrderRecord | undefined : undefined;
}

export async function getOrderItems(orderRecordId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/order_items?order_id=eq.${encodeURIComponent(orderRecordId)}&select=*`,
    { method: 'GET' },
  );

  return Array.isArray(result) ? result as OrderItemRecord[] : [];
}

export async function getCouponDiscount(userId: string, couponId: string | undefined, order: Order) {
  if (!couponId) return { discountAmount: 0, snapshot: undefined };
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?id=eq.${encodeURIComponent(couponId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.reserved&reservation_expires_at=lt.${encodeURIComponent(now)}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'available', reserved_at: null, reservation_expires_at: null, reserved_order_id: null }) },
  );
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?id=eq.${encodeURIComponent(couponId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.available&select=id,expires_at,coupons(code,title,status,discount_amount,discount_type,discount_value,min_order_amount,max_discount_amount,valid_from,valid_until,applicable_order_types,applicable_payment_methods,applicable_branch_ids,exclude_delivery_fee)`,
    { method: 'GET' },
  );
  const coupon = Array.isArray(rows) ? rows[0] as any : null;
  if (!coupon?.id) throw new Error('优惠券不可用');
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw new Error('优惠券已过期');
  }
  const campaign = coupon.coupons;
  if (!campaign || campaign.status !== 'active') throw new Error('优惠券活动未开始或已暂停');
  if (campaign.valid_from && new Date(campaign.valid_from).getTime() > Date.now()) throw new Error('优惠券活动尚未开始');
  if (campaign.valid_until && new Date(campaign.valid_until).getTime() <= Date.now()) throw new Error('优惠券活动已结束');
  if (Array.isArray(campaign.applicable_order_types) && !campaign.applicable_order_types.includes(order.orderType)) throw new Error('优惠券不适用于当前用餐方式');
  if (Array.isArray(campaign.applicable_payment_methods) && !campaign.applicable_payment_methods.includes(order.paymentMethod)) throw new Error('优惠券不适用于当前支付方式');
  const branchId = order.assignedBranch?.id || order.deliveryQuote?.branchId;
  if (Array.isArray(campaign.applicable_branch_ids) && campaign.applicable_branch_ids.length > 0 && (!branchId || !campaign.applicable_branch_ids.includes(branchId))) {
    throw new Error('优惠券不适用于当前门店');
  }
  const { subtotal, deliveryFee } = calculateTotals({ ...order, discountAmount: 0 });
  const eligibleAmount = roundMoney(subtotal + (campaign.exclude_delivery_fee === false ? deliveryFee : 0));
  const minOrderAmount = Number(campaign.min_order_amount || 0);
  if (eligibleAmount < minOrderAmount) throw new Error(`订单优惠金额需满 RM ${minOrderAmount.toFixed(2)}`);
  const discountType = campaign.discount_type === 'percentage' ? 'percentage' : 'fixed';
  const discountValue = Number(campaign.discount_value ?? campaign.discount_amount ?? 0);
  let discountAmount = discountType === 'percentage' ? eligibleAmount * discountValue / 100 : discountValue;
  if (campaign.max_discount_amount != null) discountAmount = Math.min(discountAmount, Number(campaign.max_discount_amount));
  discountAmount = roundMoney(Math.min(Math.max(discountAmount, 0), eligibleAmount));
  return {
    discountAmount,
    snapshot: {
      code: String(campaign.code || ''),
      title: String(campaign.title || '优惠券'),
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount: campaign.max_discount_amount == null ? null : Number(campaign.max_discount_amount),
      excludeDeliveryFee: campaign.exclude_delivery_fee !== false,
    } as NonNullable<Order['couponSnapshot']>,
  };
}

export async function reserveCoupon(couponId?: string, userId?: string) {
  if (!couponId || !userId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/reserve_user_coupon', {
    method: 'POST',
    body: JSON.stringify({ user_coupon_id_input: couponId, user_id_input: userId, reservation_minutes_input: 30 }),
  });
  if (result !== true) throw new Error('优惠券已被其他订单使用，请重新选择');
}

export async function bindCouponReservation(couponId: string | undefined, userId: string | undefined, orderId: string) {
  if (!couponId || !userId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?id=eq.${encodeURIComponent(couponId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.reserved`, {
    method: 'PATCH',
    body: JSON.stringify({ reserved_order_id: orderId }),
  });
}

export async function releaseCoupon(couponId?: string, userId?: string) {
  if (!couponId || !userId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/release_user_coupon', {
    method: 'POST',
    body: JSON.stringify({ user_coupon_id_input: couponId, user_id_input: userId }),
  });
}

export async function markCouponUsed(couponId?: string, userId?: string, orderId?: string) {
  if (!couponId || !userId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?id=eq.${encodeURIComponent(couponId)}&user_id=eq.${encodeURIComponent(userId)}&status=in.(available,reserved)`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'used',
        used_at: new Date().toISOString(),
        used_order_id: orderId || null,
        reserved_at: null,
        reservation_expires_at: null,
        reserved_order_id: null,
      }),
    },
  );
  if (orderId) await updateOrderById(orderId, { coupon_status: 'applied' });
}

export async function processWalletPayment(userId: string, orderId: string, amount: number) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/process_wallet_payment', {
    method: 'POST',
    body: JSON.stringify({
      user_id_input: userId,
      order_id_input: orderId,
      amount_input: amount,
    }),
  });
}

export async function uploadReceipt(orderNo: string, receiptImage: ReceiptImage) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const extension = extensionFromMimeType(receiptImage.mimeType);
  const safeName = receiptImage.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  const objectPath = `${orderNo}/${Date.now()}-${safeName || `receipt.${extension}`}`;
  const bytes = Buffer.from(receiptImage.dataBase64, 'base64');

  const response = await fetch(`${supabaseUrl}/storage/v1/object/payment-receipts/${objectPath}`, {
    method: 'POST',
    headers: {
      ...supabaseAuthHeaders(serviceRoleKey),
      'Content-Type': receiptImage.mimeType,
      'x-upsert': 'true',
    },
    body: bytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Receipt upload failed with ${response.status}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/payment-receipts/${objectPath}`;
}

export async function supabaseRequest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit,
) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1${path}`, {
    ...init,
    headers: {
      ...supabaseAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return null;

  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : null;
}

export async function notifyStaffFromOrder(order: Order, orderNo: string, extra: Partial<OrderRecord> = {}) {
  const { subtotal, deliveryFee, serviceCharge, total, discountAmount, payableTotal } = calculateTotals(order);
  return sendTelegramOrderNotification(buildStaffMessage({
    orderNo,
    orderStatus: extra.status || 'pending_confirm',
    createdAt: extra.created_at,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    paymentStatus: extra.payment_status || paymentStatusFor(order.paymentMethod),
    paymentReviewStatus: extra.payment_review_status || reviewStatusFor(order.paymentMethod),
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    tableNo: order.orderType === 'dinein' ? order.dineIn?.tableNo : null,
    deliveryAddress: order.orderType === 'takeaway' ? order.takeaway?.address : null,
    assignedBranchName: order.assignedBranch?.name || (order.orderType === 'takeaway' ? order.deliveryQuote?.branchName : null),
    deliveryDistanceKm: order.orderType === 'takeaway' ? order.deliveryQuote?.distanceKm : null,
    deliveryDurationMin: order.orderType === 'takeaway' ? order.deliveryQuote?.durationMin : null,
    items: order.items.map(item => ({
      code: item.code,
      name: item.name,
      quantity: item.qty,
      lineTotal: roundMoney(item.price * item.qty),
      options: item.options || [],
      note: item.note,
    })),
    subtotal,
    deliveryFee,
    serviceCharge,
    total,
    discountAmount,
    payableTotal,
    note: order.note,
    receiptUrl: extra.receipt_url,
    approveUrl: (extra as { approve_url?: string }).approve_url,
    rejectUrl: (extra as { reject_url?: string }).reject_url,
    stripeCheckoutSessionId: extra.stripe_checkout_session_id,
    stripePaymentIntentId: extra.stripe_payment_intent_id,
  }), 'review');
}

export async function notifyStaffFromRecord(order: OrderRecord, items: OrderItemRecord[]) {
  return sendTelegramOrderNotification(buildReviewMessageFromRecord(order, items), 'review');
}

function buildReviewMessageFromRecord(order: OrderRecord, items: OrderItemRecord[]) {
  return buildStaffMessage({
    orderNo: order.order_no,
    orderStatus: order.status,
    createdAt: order.created_at,
    orderType: order.order_type,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentReviewStatus: order.payment_review_status,
    lastOperatorName: order.last_operator_name,
    lastStatusChangedAt: order.last_status_changed_at,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    tableNo: order.table_no,
    deliveryAddress: order.delivery_address,
    assignedBranchName: order.assigned_branch_name,
    deliveryDistanceKm: order.delivery_distance_km,
    deliveryDurationMin: order.delivery_duration_min,
    items: items.map(item => ({
      code: item.item_code || undefined,
      name: item.name,
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
      options: item.selected_options || [],
      note: item.item_note || undefined,
    })),
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee || 0),
    serviceCharge: Number(order.service_charge),
    total: Number(order.total),
    discountAmount: Number(order.discount_amount || 0),
    payableTotal: Number(order.payable_total ?? order.total),
    note: order.note || undefined,
    receiptUrl: order.receipt_url,
    stripeCheckoutSessionId: order.stripe_checkout_session_id,
    stripePaymentIntentId: order.stripe_payment_intent_id,
  });
}

export async function editTelegramOrderMessage(order: OrderRecord, items: OrderItemRecord[]) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = order.review_tg_chat_id || order.telegram_chat_id;
  const messageId = order.review_tg_message_id || order.telegram_message_id;

  if (!token || !chatId || !messageId) return false;

  const message = buildReviewMessageFromRecord(order, items);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: message,
        reply_markup: { inline_keyboard: [] },
      }),
    });

    if (!response.ok) {
      console.error('Telegram edit failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram edit error:', error);
    return false;
  }
}

export async function editTelegramKitchenMessage(order: OrderRecord, phase: 'cooking' | 'kitchen_done' | 'stock_issue') {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = order.kitchen_tg_chat_id;
  const messageId = order.kitchen_tg_message_id;

  if (!token || !chatId || !messageId) return false;
  if (
    (order.review_tg_chat_id || order.telegram_chat_id) === chatId
    && (order.review_tg_message_id || order.telegram_message_id) === messageId
  ) {
    return false;
  }

  const nowText = formatMalaysiaTime(new Date());
  const message = {
    cooking: `🔵 制作中 ${order.order_no}\n开始：${nowText}`,
    kitchen_done: `✅ 已完成 ${order.order_no}\n完成：${nowText}`,
    stock_issue: `🔴 缺货异常 ${order.order_no}\n时间：${nowText}`,
  }[phase];

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: message,
        reply_markup: { inline_keyboard: [] },
      }),
    });

    if (!response.ok) {
      console.error('Telegram kitchen edit failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram kitchen edit error:', error);
    return false;
  }
}

export async function notifyKitchenFromRecord(order: OrderRecord, items: OrderItemRecord[]) {
  return sendTelegramOrderNotification(buildKitchenMessage(order, items), 'kitchen');
}

export async function editTelegramDeliveryMessage(order: OrderRecord, items: OrderItemRecord[]) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = order.delivery_tg_chat_id;
  const messageId = order.delivery_tg_message_id;
  if (!token || !chatId || !messageId) return false;
  return editTelegramMessage(token, chatId, messageId, buildDeliveryMessage(order, items));
}

export async function notifyDeliveryFromRecord(order: OrderRecord, items: OrderItemRecord[]) {
  if (order.order_type !== 'takeaway') return { status: 'failed' as const };
  return sendTelegramOrderNotification(buildDeliveryMessage(order, items), 'delivery');
}

export async function answerTelegramCallback(callbackQueryId: string, text: string, alert = false) {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token || !callbackQueryId) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: alert,
      }),
    });

    if (!response.ok) {
      console.error('Telegram callback answer failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram callback answer error:', error);
    return false;
  }
}

export async function sendTelegramNotification(message: string): Promise<NotificationStatus> {
  const result = await sendTelegramOrderNotification(message, 'review');
  return result.status;
}

export async function sendTelegramOrderNotification(message: string, channel: 'review' | 'kitchen' | 'delivery' = 'review'): Promise<TelegramNotificationResult> {
  const token = process.env.TELEGRAM_TOKEN;
  const chatIds = await getTelegramOrderNotificationChatIds(channel);

  if (!token || chatIds.length === 0) return { status: 'failed' };

  try {
    const results = await Promise.all(chatIds.map(chatId => sendTelegramMessageToChat(token, chatId, message)));
    const firstSuccess = results.find(result => result.ok);

    if (!firstSuccess) return { status: 'failed' };
    return {
      status: 'sent',
      chatId: firstSuccess.chatId,
      messageId: firstSuccess.messageId,
    };
  } catch (error) {
    console.error('Telegram notification error:', error);
    return { status: 'failed' };
  }
}

export async function sendTelegramMessage(chatId: string, message: string, replyMarkup?: InlineKeyboardMarkup) {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token || !chatId) return false;

  const result = await sendTelegramMessageToChat(token, chatId, message, replyMarkup);
  return result.ok;
}

async function sendTelegramMessageToChat(token: string, chatId: string, message: string, replyMarkup?: InlineKeyboardMarkup): Promise<TelegramSendResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    if (!response.ok) {
      console.error('Telegram message send failed:', await response.text());
      return { ok: false };
    }

    const payload = await response.json();
    return {
      ok: true,
      chatId: String(payload?.result?.chat?.id || chatId),
      messageId: Number(payload?.result?.message_id || 0) || undefined,
    };
  } catch (error) {
    console.error('Telegram message send error:', error);
    return { ok: false };
  }
}

async function getTelegramOrderNotificationChatIds(channel: 'review' | 'kitchen' | 'delivery') {
  const envKey = {
    review: 'TELEGRAM_REVIEW_CHAT_ID',
    kitchen: 'TELEGRAM_KITCHEN_CHAT_ID',
    delivery: 'TELEGRAM_DELIVERY_CHAT_ID',
  }[channel];
  const chatIds = [process.env[envKey] || ''].map(value => value.trim()).filter(Boolean);

  if (channel === 'review' && chatIds.length === 0) {
    chatIds.push(...[
      process.env.TELEGRAM_CHAT_ID || '',
      ...(process.env.TELEGRAM_ADMIN_IDS || '').split(','),
    ].map(value => value.trim()).filter(Boolean));
  }

  if (channel === 'review') try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const result = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/telegram_users?is_admin=eq.true&select=telegram_user_id',
      { method: 'GET' },
    );

    if (Array.isArray(result)) {
      for (const row of result) {
        const userId = String((row as { telegram_user_id?: string }).telegram_user_id || '').trim();
        if (userId) chatIds.push(userId);
      }
    }
  } catch (error) {
    console.error('Telegram admin notification lookup failed:', error);
  }

  return [...new Set(chatIds)];
}

async function editTelegramMessage(token: string, chatId: string, messageId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: [] },
      }),
    });
    if (!response.ok) {
      console.error('Telegram edit failed:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram edit error:', error);
    return false;
  }
}

function buildStaffMessage(params: {
  orderNo: string;
  orderStatus: OrderStatus;
  createdAt?: string | null;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReviewStatus: PaymentReviewStatus;
  lastOperatorName?: string | null;
  lastStatusChangedAt?: string | null;
  customerName: string;
  customerPhone: string;
  tableNo?: string | null;
  deliveryAddress?: string | null;
  assignedBranchName?: string | null;
  deliveryDistanceKm?: number | null;
  deliveryDurationMin?: number | null;
  items: {
    code?: string;
    name: string;
    quantity: number;
    lineTotal: number;
    options?: Order['items'][number]['options'];
    note?: string;
  }[];
  subtotal: number;
  deliveryFee?: number;
  serviceCharge: number;
  total: number;
  discountAmount?: number;
  payableTotal?: number;
  note?: string;
  receiptUrl?: string | null;
  approveUrl?: string;
  rejectUrl?: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}) {
  const itemsText = params.items
    .map((item, index) => {
      const itemName = item.code ? `[${item.code}] ${item.name}` : item.name;
      const optionText = item.options?.length
        ? `\n   选项: ${item.options.map(option => `${option.groupName}-${option.name}${option.priceDelta > 0 ? `(+RM ${Number(option.priceDelta).toFixed(2)})` : ''}`).join(', ')}`
        : '';
      const noteText = item.note ? `\n   单品备注: ${item.note}` : '';
      return `${index + 1}. ${itemName} ×${item.quantity}\n   RM ${Number(item.lineTotal).toFixed(2)}${optionText}${noteText}`;
    })
    .join('\n');

  const actionText = staffActionFor(params.paymentMethod);
  const locationText = params.orderType === 'dinein'
    ? [`桌号：${params.tableNo || '-'}`]
    : [
        `分配门店：${params.assignedBranchName || '-'}`,
        `地址：${params.deliveryAddress || '-'}`,
        `配送距离：${formatOptionalNumber(params.deliveryDistanceKm, 'km')}`,
        `预计时间：${formatOptionalNumber(params.deliveryDurationMin, '分钟')}`,
      ];
  const receiptText = params.receiptUrl ? `\nTouch 'n Go eWallet 截图: ${params.receiptUrl}` : '';
  const reviewText = params.approveUrl && params.rejectUrl
    ? `\n\n[付款审核]\n通过: ${params.approveUrl}\n拒绝: ${params.rejectUrl}`
    : '';
  const stripeText = params.stripeCheckoutSessionId
    ? `\nStripe Session: ${params.stripeCheckoutSessionId}${params.stripePaymentIntentId ? `\nPayment Intent: ${params.stripePaymentIntentId}` : ''}`
    : '';
  const orderTime = params.createdAt ? new Date(params.createdAt) : new Date();
  const operatorText = params.lastOperatorName
    ? [`最后操作人：${params.lastOperatorName}`, params.lastStatusChangedAt ? `操作时间：${formatMalaysiaDate(new Date(params.lastStatusChangedAt))}` : ''].filter(Boolean)
    : [];

  return [
    `📢 新订单通知`,
    ``,
    `订单号：${params.orderNo}`,
    `下单时间：${formatMalaysiaDate(orderTime)}`,
    ``,
    `🔘 处理状态`,
    `处理动作：${actionText}`,
    `订单状态：${labelOrderStatus(params.orderStatus)}`,
    `订单类型：${labelOrderType(params.orderType)}`,
    `支付方式：${labelPaymentMethod(params.paymentMethod)}`,
    `支付状态：${labelPaymentStatus(params.paymentStatus)}`,
    `审核状态：${labelReviewStatus(params.paymentReviewStatus)}`,
    ...operatorText,
    ``,
    `👤 顾客资料`,
    `姓名：${params.customerName}`,
    `电话：${params.customerPhone}`,
    ...locationText,
    ``,
    `🍲 菜品明细`,
    `---------------`,
    itemsText || '无',
    `---------------`,
    ``,
    `💰 金额明细`,
    `小计：RM ${Number(params.subtotal).toFixed(2)}`,
    `配送费：RM ${Number(params.deliveryFee || 0).toFixed(2)}`,
    `原价总额：RM ${Number(params.total).toFixed(2)}`,
    `优惠抵扣：RM ${Number(params.discountAmount || 0).toFixed(2)}`,
    `实付金额：RM ${Number(params.payableTotal ?? params.total).toFixed(2)}`,
    ``,
    `📝 备注`,
    params.note || '无',
    `${receiptText}${reviewText}${stripeText}`,
    ``,
    labelTelegramOperationHint(params.orderStatus, params.paymentStatus, params.paymentReviewStatus),
  ].join('\n').trim();
}

function buildKitchenMessage(order: OrderRecord, items: OrderItemRecord[]) {
  const tableText = order.order_type === 'dinein' ? `堂食 · ${order.table_no || '-'}桌` : '外卖';
  const startedText = order.kitchen_started_at ? `\n开始：${formatMalaysiaTime(new Date(order.kitchen_started_at))}` : '';
  const completedText = order.kitchen_completed_at ? `\n完成：${formatMalaysiaTime(new Date(order.kitchen_completed_at))}` : '';
  const itemsText = items.map(item => {
    const code = item.item_code ? `[${item.item_code}] ` : '';
    const note = item.item_note ? `\n   备注：${item.item_note}` : '';
    return `${code}${item.name} x${item.quantity}${note}`;
  }).join('\n');

  return [
    `${labelKitchenTelegramStatus(order.status)} ${order.order_no}`,
    tableText,
    startedText.trim(),
    completedText.trim(),
    '',
    '🍲 菜品',
    itemsText || '无',
    '',
    `备注：${order.note || '无'}`,
  ].filter(line => line !== '').join('\n').trim();
}

function buildDeliveryMessage(order: OrderRecord, items: OrderItemRecord[]) {
  const itemsText = items.map(item => {
    const code = item.item_code ? `[${item.item_code}] ` : '';
    return `${code}${item.name} x${item.quantity}`;
  }).join('\n');
  return [
    `🛵 配送订单 ${order.order_no}`,
    `状态：${labelOrderStatus(order.status)}`,
    `顾客：${order.customer_name}`,
    `电话：${order.customer_phone}`,
    `地址：${order.delivery_address || '-'}`,
    `门店：${order.assigned_branch_name || '-'}`,
    `配送距离：${formatOptionalNumber(order.delivery_distance_km, 'km')}`,
    `预计时间：${formatOptionalNumber(order.delivery_duration_min, '分钟')}`,
    '',
    '🍲 菜品',
    itemsText || '无',
    '',
    `备注：${order.note || '无'}`,
  ].join('\n').trim();
}

function labelKitchenTelegramStatus(status: OrderStatus) {
  if (status === 'waiting_kitchen') return '🟠 待制作';
  if (status === 'cooking') return '🔵 制作中';
  if (status === 'kitchen_done') return '✅ 已完成';
  if (status === 'stock_issue') return '🔴 缺货异常';
  return `⚪ ${labelOrderStatus(status)}`;
}

function canOperateOrder(paymentStatus: PaymentStatus, paymentReviewStatus: PaymentReviewStatus) {
  return paymentStatus === 'paid' && paymentReviewStatus !== 'pending' && paymentReviewStatus !== 'rejected';
}

function labelTelegramOperationHint(status: OrderStatus, paymentStatus: PaymentStatus, paymentReviewStatus: PaymentReviewStatus) {
  if (!canOperateOrder(paymentStatus, paymentReviewStatus)) return '请在后台完成付款/审核处理';
  if (status === 'pending_confirm') return '请在后台确认或取消订单';
  if (status === 'waiting_kitchen' || status === 'cooking') return '厨房状态由厨房页面同步';
  if (status === 'kitchen_done') return '请在后台处理打包/配送';
  if (status === 'stock_issue') return '请在后台处理缺货异常';
  if (status === 'delivering' || status === 'delivered') return '请在后台更新配送状态';
  return '请以后台订单状态为准';
}

export function isOrderStatus(value: string): value is OrderStatus {
  return [
    'pending_confirm',
    'waiting_kitchen',
    'cooking',
    'kitchen_done',
    'stock_issue',
    'preparing',
    'delivering',
    'delivered',
    'completed',
    'cancelled',
  ].includes(value);
}

function paymentStatusFor(paymentMethod: PaymentMethod): PaymentStatus {
  if (paymentMethod === 'cash') return 'pay_at_counter';
  if (paymentMethod === 'tng') return 'pending_review';
  if (paymentMethod === 'wallet') return 'paid';
  return 'awaiting_payment';
}

function reviewStatusFor(paymentMethod: PaymentMethod): PaymentReviewStatus {
  return paymentMethod === 'tng' ? 'pending' : 'not_required';
}

function staffActionFor(paymentMethod: PaymentMethod) {
  if (paymentMethod === 'cash') return '准备订单，柜台/送达时收款';
  if (paymentMethod === 'tng') return "先审核 Touch 'n Go eWallet 付款截图，再处理订单";
  if (paymentMethod === 'wallet') return '钱包已付款，直接处理订单';
  return 'Stripe已付款，直接处理订单';
}

function labelOrderStatus(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    pending_confirm: '待确认',
    waiting_kitchen: '待制作',
    cooking: '制作中',
    kitchen_done: '厨房完成',
    stock_issue: '缺货异常',
    preparing: '制作中',
    delivering: '配送中',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
  };
  return labels[status];
}

function formatMalaysiaTime(value: Date) {
  return value.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMalaysiaDate(value: Date) {
  return value.toLocaleString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatOptionalNumber(value: number | null | undefined, unit: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return '-';
  return `${numberValue.toFixed(unit === 'km' ? 2 : 0)} ${unit}`;
}

function labelOrderType(orderType: OrderType) {
  return orderType === 'dinein' ? '堂食' : '外卖';
}

function labelPaymentMethod(paymentMethod: PaymentMethod) {
  if (paymentMethod === 'cash') return '现金';
  if (paymentMethod === 'tng') return "Touch 'n Go eWallet 转账";
  if (paymentMethod === 'wallet') return '钱包余额';
  return 'Stripe线上付款';
}

function labelPaymentStatus(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    pay_at_counter: '到店/送达时收款',
    pending_review: '等待人工审核',
    awaiting_payment: '等待Stripe付款',
    paid: '已付款',
  };
  return labels[status] || status;
}

function labelReviewStatus(status: PaymentReviewStatus) {
  const labels: Record<PaymentReviewStatus, string> = {
    not_required: '无需审核',
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  };
  return labels[status] || status;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export function generateOrderId() {
  const now = new Date();
  const datePart =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

  return `SOUP-${datePart}-${randomPart}`;
}

export function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
