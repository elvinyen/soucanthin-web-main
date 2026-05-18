import type { Order, OrderType, PaymentMethod, ReceiptImage } from '../types/order';

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string | string[]) => void;
  end?: (body?: unknown) => void;
};

export type ApiRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, callback: (chunk?: Buffer) => void) => void;
};

export type NotificationStatus = 'sent' | 'failed';
export type PaymentStatus = 'pay_at_counter' | 'pending_review' | 'awaiting_payment' | 'paid';
export type PaymentReviewStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export type OrderRecord = {
  id: string;
  order_no: string;
  user_id?: string | null;
  order_type: OrderType;
  payment_method: PaymentMethod;
  customer_name: string;
  customer_phone: string;
  table_no?: string | null;
  delivery_address?: string | null;
  note?: string | null;
  subtotal: number;
  service_charge: number;
  total: number;
  discount_amount?: number;
  payable_total?: number;
  coupon_id?: string | null;
  status: string;
  payment_status: PaymentStatus;
  payment_review_status: PaymentReviewStatus;
  receipt_url?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  payment_review_token?: string | null;
  reviewed_at?: string | null;
  notification_status: NotificationStatus | 'pending';
  created_at: string;
};

export type OrderItemRecord = {
  id?: string;
  order_id: string;
  menu_item_id: string;
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
  if (!receiptImage) return 'TNG receipt image is required';
  if (!receiptImage.fileName?.trim()) return 'Receipt file name is required';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(receiptImage.mimeType)) {
    return 'Receipt must be a JPG, PNG, or WEBP image';
  }

  const byteLength = Buffer.byteLength(receiptImage.dataBase64 || '', 'base64');
  if (!receiptImage.dataBase64 || byteLength === 0) return 'Receipt image is empty';
  if (byteLength > 5 * 1024 * 1024) return 'Receipt image must be under 5MB';

  return '';
}

export function calculateTotals(order: Order) {
  const subtotal = roundMoney(order.items.reduce((sum, item) => sum + item.price * item.qty, 0));
  const serviceCharge = roundMoney(subtotal * 0.06);
  const total = roundMoney(subtotal + serviceCharge);
  const discountAmount = roundMoney(Math.min(Math.max(Number(order.discountAmount || 0), 0), total));
  const payableTotal = roundMoney(Math.max(total - discountAmount, 0));
  return { subtotal, serviceCharge, total, discountAmount, payableTotal };
}

export async function createOrderWithItems(params: {
  order: Order;
  orderNo: string;
  status: string;
  paymentStatus: PaymentStatus;
  paymentReviewStatus: PaymentReviewStatus;
  receiptUrl?: string | null;
  stripeCheckoutSessionId?: string | null;
  discountAmount?: number;
  paymentReviewToken?: string | null;
}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const nextOrder = { ...params.order, discountAmount: params.discountAmount ?? params.order.discountAmount ?? 0 };
  const { subtotal, serviceCharge, total, discountAmount, payableTotal } = calculateTotals(nextOrder);
  const createdAt = params.order.createdAt || new Date().toISOString();

  const orderRecord = await insertOrder(supabaseUrl, serviceRoleKey, {
    order_no: params.orderNo,
    user_id: params.order.userId || null,
    order_type: params.order.orderType,
    payment_method: params.order.paymentMethod,
    customer_name: params.order.customer.name.trim(),
    customer_phone: params.order.customer.phone.trim(),
    table_no: params.order.orderType === 'dinein' ? params.order.dineIn?.tableNo.trim() : null,
    delivery_address: params.order.orderType === 'takeaway' ? params.order.takeaway?.address.trim() : null,
    note: params.order.note?.trim() || null,
    subtotal,
    service_charge: serviceCharge,
    total,
    coupon_id: params.order.couponId || null,
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
    name: item.name,
    unit_base_price: roundMoney(item.basePrice ?? item.price),
    unit_options_total: roundMoney(item.optionsTotal ?? 0),
    unit_price: roundMoney(item.price),
    quantity: item.qty,
    line_total: roundMoney(item.price * item.qty),
    selected_options: item.options || [],
    item_note: item.note?.trim() || null,
  })));

  return { orderRecord, subtotal, serviceCharge, total, discountAmount, payableTotal };
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

export async function getCouponDiscount(userId: string, couponId: string | undefined, orderTotal: number) {
  if (!couponId) return 0;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?id=eq.${encodeURIComponent(couponId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.available&select=id,expires_at,coupons(discount_amount)`,
    { method: 'GET' },
  );
  const coupon = Array.isArray(rows) ? rows[0] as any : null;
  if (!coupon?.id) throw new Error('优惠券不可用');
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw new Error('优惠券已过期');
  }
  return roundMoney(Math.min(Number(coupon.coupons?.discount_amount || 0), orderTotal));
}

export async function markCouponUsed(couponId?: string, userId?: string) {
  if (!couponId || !userId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/user_coupons?id=eq.${encodeURIComponent(couponId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.available`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'used', used_at: new Date().toISOString() }),
    },
  );
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
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
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
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
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
  const { subtotal, serviceCharge, total, discountAmount, payableTotal } = calculateTotals(order);
  return sendTelegramNotification(buildStaffMessage({
    orderNo,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    paymentStatus: extra.payment_status || paymentStatusFor(order.paymentMethod),
    paymentReviewStatus: extra.payment_review_status || reviewStatusFor(order.paymentMethod),
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    tableNo: order.orderType === 'dinein' ? order.dineIn?.tableNo : null,
    deliveryAddress: order.orderType === 'takeaway' ? order.takeaway?.address : null,
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.qty,
      lineTotal: roundMoney(item.price * item.qty),
      options: item.options || [],
      note: item.note,
    })),
    subtotal,
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
  }));
}

export async function notifyStaffFromRecord(order: OrderRecord, items: OrderItemRecord[]) {
  return sendTelegramNotification(buildStaffMessage({
    orderNo: order.order_no,
    orderType: order.order_type,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentReviewStatus: order.payment_review_status,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    tableNo: order.table_no,
    deliveryAddress: order.delivery_address,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
      options: item.selected_options || [],
      note: item.item_note || undefined,
    })),
    subtotal: Number(order.subtotal),
    serviceCharge: Number(order.service_charge),
    total: Number(order.total),
    discountAmount: Number(order.discount_amount || 0),
    payableTotal: Number(order.payable_total ?? order.total),
    note: order.note || undefined,
    receiptUrl: order.receipt_url,
    stripeCheckoutSessionId: order.stripe_checkout_session_id,
    stripePaymentIntentId: order.stripe_payment_intent_id,
  }));
}

export async function sendTelegramNotification(message: string): Promise<NotificationStatus> {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return 'failed';

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    if (!response.ok) {
      console.error('Telegram send failed:', await response.text());
      return 'failed';
    }

    return 'sent';
  } catch (error) {
    console.error('Telegram notification error:', error);
    return 'failed';
  }
}

function buildStaffMessage(params: {
  orderNo: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReviewStatus: PaymentReviewStatus;
  customerName: string;
  customerPhone: string;
  tableNo?: string | null;
  deliveryAddress?: string | null;
  items: {
    name: string;
    quantity: number;
    lineTotal: number;
    options?: Order['items'][number]['options'];
    note?: string;
  }[];
  subtotal: number;
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
    .map(item => {
      const optionText = item.options?.length
        ? `\n   选项: ${item.options.map(option => `${option.groupName}-${option.name}${option.priceDelta > 0 ? `(+RM ${Number(option.priceDelta).toFixed(2)})` : ''}`).join(', ')}`
        : '';
      const noteText = item.note ? `\n   单品备注: ${item.note}` : '';
      return `${item.quantity}x ${item.name}  RM ${Number(item.lineTotal).toFixed(2)}${optionText}${noteText}`;
    })
    .join('\n');

  const actionText = staffActionFor(params.paymentMethod);
  const locationText = params.orderType === 'dinein'
    ? `桌号: ${params.tableNo || '-'}`
    : `地址: ${params.deliveryAddress || '-'}`;
  const receiptText = params.receiptUrl ? `\nTNG截图: ${params.receiptUrl}` : '';
  const reviewText = params.approveUrl && params.rejectUrl
    ? `\n\n[付款审核]\n通过: ${params.approveUrl}\n拒绝: ${params.rejectUrl}`
    : '';
  const stripeText = params.stripeCheckoutSessionId
    ? `\nStripe Session: ${params.stripeCheckoutSessionId}${params.stripePaymentIntentId ? `\nPayment Intent: ${params.stripePaymentIntentId}` : ''}`
    : '';

  return [
    `[员工订单后台] 新订单`,
    ``,
    `订单号: ${params.orderNo}`,
    `处理动作: ${actionText}`,
    `订单类型: ${labelOrderType(params.orderType)}`,
    `支付方式: ${labelPaymentMethod(params.paymentMethod)}`,
    `支付状态: ${labelPaymentStatus(params.paymentStatus)}`,
    `审核状态: ${labelReviewStatus(params.paymentReviewStatus)}`,
    ``,
    `[顾客资料]`,
    `姓名: ${params.customerName}`,
    `电话: ${params.customerPhone}`,
    locationText,
    ``,
    `[菜品明细]`,
    itemsText,
    ``,
    `[金额]`,
    `小计: RM ${Number(params.subtotal).toFixed(2)}`,
    `SST 6%: RM ${Number(params.serviceCharge).toFixed(2)}`,
    `原价总额: RM ${Number(params.total).toFixed(2)}`,
    `优惠抵扣: RM ${Number(params.discountAmount || 0).toFixed(2)}`,
    `实付金额: RM ${Number(params.payableTotal ?? params.total).toFixed(2)}`,
    ``,
    `[备注]`,
    params.note || '无',
    `${receiptText}${reviewText}${stripeText}`,
    ``,
    `下单时间: ${new Date().toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`,
  ].join('\n').trim();
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
  if (paymentMethod === 'tng') return '先审核TNG付款截图，再处理订单';
  if (paymentMethod === 'wallet') return '钱包已付款，直接处理订单';
  return 'Stripe已付款，直接处理订单';
}

function labelOrderType(orderType: OrderType) {
  return orderType === 'dinein' ? '堂食' : '外卖';
}

function labelPaymentMethod(paymentMethod: PaymentMethod) {
  if (paymentMethod === 'cash') return '现金';
  if (paymentMethod === 'tng') return 'TNG转账';
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
