import { randomBytes } from 'node:crypto';
import {
  ApiRequest,
  ApiResponse,
  createOrderWithItems,
  calculateTotals,
  generateOrderId,
  getCouponDiscount,
  markCouponUsed,
  notifyStaffFromOrder,
  parseOrderBody,
  processWalletPayment,
  updateOrderById,
  uploadReceipt,
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

  const validationError = validateOrder(order, ['tng', 'wallet']);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  const orderNo = generateOrderId();

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

    const { total } = calculateTotals({ ...order, discountAmount: 0 });
    const discountAmount = user ? await getCouponDiscount(user.id, order.couponId, total) : 0;
    order.discountAmount = discountAmount;
    order.payableTotal = Math.max(total - discountAmount, 0);

    if (order.paymentMethod === 'wallet' && user && order.payableTotal > 0) {
      const wallet = await getWallet(user.id);
      if (wallet.balance < order.payableTotal) {
        return res.status(400).json({ success: false, error: '钱包余额不足，请先充值或更换支付方式' });
      }
    }

    const receiptUrl = order.paymentMethod === 'tng'
      ? await uploadReceipt(orderNo, order.receiptImage!)
      : null;

    const paymentStatus = order.paymentMethod === 'wallet'
      ? 'paid'
      : 'pending_review';
    const paymentReviewStatus = order.paymentMethod === 'tng' ? 'pending' : 'not_required';
    const status = 'pending_confirm';
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

    if (order.paymentMethod === 'wallet' && user && order.payableTotal > 0) {
      await processWalletPayment(user.id, orderRecord.id, order.payableTotal);
      await updateOrderById(orderRecord.id, { paid_at: new Date().toISOString() });
      await markCouponUsed(order.couponId, user.id);
    } else if (order.paymentMethod === 'wallet' && user) {
      await updateOrderById(orderRecord.id, { paid_at: new Date().toISOString() });
      await markCouponUsed(order.couponId, user.id);
    }

    const notification = await notifyStaffFromOrder(order, orderNo, {
      status,
      payment_status: paymentStatus,
      payment_review_status: paymentReviewStatus,
      receipt_url: receiptUrl,
      ...(paymentReviewToken ? buildTngReviewLinks(orderRecord.id, paymentReviewToken) : {}),
    });

    await updateOrderById(orderRecord.id, {
      notification_status: notification.status,
      notified_at: notification.status === 'sent' ? new Date().toISOString() : null,
      telegram_chat_id: notification.chatId || null,
      telegram_message_id: notification.messageId || null,
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
