import { randomBytes } from 'node:crypto';
import {
  ApiRequest,
  ApiResponse,
  bindCouponReservation,
  createOrderWithItems,
  calculateTotals,
  generateOrderId,
  getCouponDiscount,
  getOrderItems,
  markCouponUsed,
  notifyKitchenFromRecord,
  notifyStaffFromOrder,
  parseOrderBody,
  processWalletPayment,
  releaseCoupon,
  reserveCoupon,
  updateOrderById,
  uploadReceipt,
  validateMenuItemsAvailable,
  validateOrder,
} from './_order-utils';
import { getAuthenticatedUser, getWallet } from './_auth-utils';
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

  const validationError = validateOrder(order, ['cash', 'tng', 'wallet']);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  if (order.paymentMethod === 'cash' && order.orderType !== 'dinein') {
    return res.status(400).json({ success: false, error: '现金支付仅支持堂食订单' });
  }

  try {
    const availabilityError = await validateMenuItemsAvailable(order);
    if (availabilityError) {
      return res.status(400).json({ success: false, error: availabilityError });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '菜单状态校验失败' });
  }

  const orderNo = generateOrderId();
  let reservedCoupon: { id: string; userId: string } | null = null;
  let createdOrderId: string | null = null;

  try {
    const user = await getAuthenticatedUser(req);
    if (user) order.userId = user.id;
    if (order.paymentMethod === 'wallet' && !user) {
      return res.status(401).json({ success: false, error: '请先登录后使用钱包支付' });
    }
    if (order.couponId && !user) {
      return res.status(401).json({ success: false, error: '请先登录后使用优惠券' });
    }

    await applyDeliveryQuoteToOrder(order);

    const couponResult = user ? await getCouponDiscount(user.id, order.couponId, order) : { discountAmount: 0, snapshot: undefined };
    const discountAmount = couponResult.discountAmount;
    order.couponSnapshot = couponResult.snapshot;
    order.discountAmount = discountAmount;
    const { total } = calculateTotals({ ...order, discountAmount: 0 });
    order.payableTotal = Math.max(total - discountAmount, 0);

    if (order.couponId && user) {
      await reserveCoupon(order.couponId, user.id);
      reservedCoupon = { id: order.couponId, userId: user.id };
    }

    if (order.paymentMethod === 'wallet' && user && order.payableTotal > 0) {
      const wallet = await getWallet(user.id);
      if (wallet.balance < order.payableTotal) {
        return res.status(400).json({ success: false, error: '钱包余额不足，请先充值或更换支付方式' });
      }
    }

    const receiptUrl = order.paymentMethod === 'tng'
      ? await uploadReceipt(orderNo, order.receiptImage!)
      : null;

    const paymentStatus = order.paymentMethod === 'cash'
      ? 'pay_at_counter'
      : order.paymentMethod === 'wallet'
      ? 'paid'
      : 'pending_review';
    const paymentReviewStatus = order.paymentMethod === 'tng' ? 'pending' : 'not_required';
    const status = (paymentStatus === 'paid' || paymentStatus === 'pay_at_counter') && paymentReviewStatus !== 'pending'
      ? 'waiting_kitchen'
      : 'pending_confirm';
    const paymentReviewToken = order.paymentMethod === 'tng' ? randomBytes(24).toString('base64url') : null;

    const { orderRecord } = await createOrderWithItems({
      order,
      orderNo,
      status,
      paymentStatus,
      paymentReviewStatus,
      receiptUrl,
      discountAmount,
      paymentReviewToken,
    });
    createdOrderId = orderRecord.id;
    await bindCouponReservation(order.couponId, user?.id, orderRecord.id);

    if (order.paymentMethod === 'wallet' && user && order.payableTotal > 0) {
      await processWalletPayment(user.id, orderRecord.id, order.payableTotal);
      await updateOrderById(orderRecord.id, { paid_at: new Date().toISOString() });
      await markCouponUsed(order.couponId, user.id, orderRecord.id);
    } else if (order.paymentMethod === 'wallet' && user) {
      await updateOrderById(orderRecord.id, { paid_at: new Date().toISOString() });
      await markCouponUsed(order.couponId, user.id, orderRecord.id);
    } else if (order.paymentMethod === 'cash' && user) {
      await markCouponUsed(order.couponId, user.id, orderRecord.id);
    }

    const notification = await notifyStaffFromOrder(order, orderNo, {
      status,
      payment_status: paymentStatus,
      payment_review_status: paymentReviewStatus,
      receipt_url: receiptUrl,
      ...(paymentReviewToken ? buildTngReviewLinks(orderRecord.id, paymentReviewToken) : {}),
    });
    const kitchenNotification = status === 'waiting_kitchen'
      ? await notifyKitchenFromRecord(orderRecord, await getOrderItems(orderRecord.id))
      : null;

    await updateOrderById(orderRecord.id, {
      notification_status: notification.status,
      notified_at: notification.status === 'sent' ? new Date().toISOString() : null,
      telegram_chat_id: notification.chatId || null,
      telegram_message_id: notification.messageId || null,
      review_tg_chat_id: notification.chatId || null,
      review_tg_message_id: notification.messageId || null,
      kitchen_tg_chat_id: kitchenNotification?.chatId || null,
      kitchen_tg_message_id: kitchenNotification?.messageId || null,
    });

    return res.status(200).json({
      success: true,
      orderId: orderNo,
      notificationStatus: notification.status,
      paymentStatus,
      paymentReviewStatus,
      discountAmount,
      payableTotal: order.payableTotal,
    });
  } catch (error) {
    if (reservedCoupon && !createdOrderId) {
      await releaseCoupon(reservedCoupon.id, reservedCoupon.userId).catch(() => undefined);
    }
    if (error instanceof DeliveryQuoteError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Order API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Order submission failed',
    });
  }
}

function buildTngReviewLinks(orderRecordId: string, reviewToken: string) {
  const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const adminToken = process.env.ADMIN_REVIEW_TOKEN || '';
  return {
    approve_url: `${siteUrl}/api/admin/order-payment-review?action=approve&id=${encodeURIComponent(orderRecordId)}&token=${encodeURIComponent(reviewToken)}&admin=${encodeURIComponent(adminToken)}`,
    reject_url: `${siteUrl}/api/admin/order-payment-review?action=reject&id=${encodeURIComponent(orderRecordId)}&token=${encodeURIComponent(reviewToken)}&admin=${encodeURIComponent(adminToken)}`,
  };
}
