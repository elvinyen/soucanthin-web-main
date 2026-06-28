import {
  ApiRequest,
  ApiResponse,
  calculateTotals,
  createOrderWithItems,
  generateOrderId,
  getCouponDiscount,
  parseOrderBody,
  updateOrderById,
  validateMenuItemsAvailable,
  validateOrder,
} from './_order-utils';
import { getAuthenticatedUser } from './_auth-utils';
import { applyDeliveryQuoteToOrder, DeliveryQuoteError } from './_delivery-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let order;

  try {
    order = parseOrderBody(req.body);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  const validationError = validateOrder(order, ['stripe']);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  try {
    const availabilityError = await validateMenuItemsAvailable(order);
    if (availabilityError) {
      return res.status(400).json({ success: false, error: availabilityError });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '菜单状态校验失败' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

  if (!stripeSecretKey) {
    return res.status(500).json({ success: false, error: 'Stripe is not configured' });
  }

  const orderNo = generateOrderId();

  try {
    const user = await getAuthenticatedUser(req);
    if (user) order.userId = user.id;
    if (order.couponId && !user) {
      return res.status(401).json({ success: false, error: '请先登录后使用优惠券' });
    }

    await applyDeliveryQuoteToOrder(order);

    const { total } = calculateTotals({ ...order, discountAmount: 0 });
    const discountAmount = user ? await getCouponDiscount(user.id, order.couponId, total) : 0;
    order.discountAmount = discountAmount;
    order.payableTotal = Math.max(total - discountAmount, 0);
    if (order.payableTotal <= 0) {
      return res.status(400).json({ success: false, error: '实付金额为 0，请改用现金或钱包提交订单' });
    }

    const { orderRecord } = await createOrderWithItems({
      order,
      orderNo,
      status: 'pending_confirm',
      paymentStatus: 'awaiting_payment',
      paymentReviewStatus: 'not_required',
      discountAmount,
    });

    const { payableTotal } = calculateTotals(order);
    const checkoutSession = await createStripeCheckoutSession({
      stripeSecretKey,
      siteUrl,
      orderNo,
      orderRecordId: orderRecord.id,
      total: payableTotal,
      customerName: order.customer.name,
    });

    await updateOrderById(orderRecord.id, {
      stripe_checkout_session_id: checkoutSession.id,
    });

    return res.status(200).json({
      success: true,
      orderId: orderNo,
      checkoutUrl: checkoutSession.url,
    });
  } catch (error) {
    if (error instanceof DeliveryQuoteError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Stripe checkout API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Stripe checkout failed',
    });
  }
}

async function createStripeCheckoutSession(params: {
  stripeSecretKey: string;
  siteUrl: string;
  orderNo: string;
  orderRecordId: string;
  total: number;
  customerName: string;
}) {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('client_reference_id', params.orderRecordId);
  body.set('success_url', `${params.siteUrl.replace(/\/$/, '')}/?payment=stripe-success&order=${encodeURIComponent(params.orderNo)}`);
  body.set('cancel_url', `${params.siteUrl.replace(/\/$/, '')}/?payment=stripe-cancel&order=${encodeURIComponent(params.orderNo)}`);
  body.set('metadata[order_id]', params.orderRecordId);
  body.set('metadata[order_no]', params.orderNo);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', 'myr');
  body.set('line_items[0][price_data][unit_amount]', String(Math.round(params.total * 100)));
  body.set('line_items[0][price_data][product_data][name]', `Soup Can Thin Order ${params.orderNo}`);
  body.set('line_items[0][price_data][product_data][description]', `Customer: ${params.customerName}`);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Unable to create Stripe Checkout Session');
  }

  if (!payload.url || !payload.id) {
    throw new Error('Stripe Checkout Session response is incomplete');
  }

  return payload as { id: string; url: string };
}
