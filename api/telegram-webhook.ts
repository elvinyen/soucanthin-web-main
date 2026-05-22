import {
  answerTelegramCallback,
  ApiRequest,
  ApiResponse,
  editTelegramOrderMessage,
  findOrderByNo,
  getOrderItems,
  updateOrderByNo,
} from './_order-utils';
import { parseJsonBody } from './_auth-utils';
import type { OrderStatus } from '../types/order';

type TelegramAction = 'confirm' | 'start_delivery' | 'delivered' | 'complete' | 'cancel';

type TelegramWebhookPayload = {
  callback_query?: {
    id?: string;
    from?: {
      id?: number;
    };
    data?: string;
  };
};

const ACTIONS: Record<TelegramAction, { from: OrderStatus[]; to: OrderStatus; label: string }> = {
  confirm: { from: ['pending_confirm'], to: 'preparing', label: '订单已进入制作中' },
  start_delivery: { from: ['preparing'], to: 'delivering', label: '订单已进入配送中' },
  delivered: { from: ['delivering'], to: 'delivered', label: '订单已标记已送达' },
  complete: { from: ['delivered'], to: 'completed', label: '订单已完成' },
  cancel: { from: ['pending_confirm', 'preparing'], to: 'cancelled', label: '订单已取消' },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let callbackId = '';
  let callbackAnswered = false;

  try {
    const payload = parseJsonBody<TelegramWebhookPayload>(req.body);
    const callback = payload.callback_query;
    callbackId = callback?.id || '';

    if (!callback) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const adminId = callback.from?.id ? String(callback.from.id) : '';
    if (!isTelegramAdmin(adminId)) {
      await answerTelegramCallback(callbackId, '无权限操作此订单', true);
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const parsed = parseCallbackData(callback.data || '');
    if (!parsed) {
      await answerTelegramCallback(callbackId, '无效的订单操作', true);
      return res.status(400).json({ success: false, error: 'Invalid callback data' });
    }

    const transition = ACTIONS[parsed.action];
    const order = await findOrderByNo(parsed.orderNo);
    if (!order) {
      await answerTelegramCallback(callbackId, '订单不存在', true);
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.payment_status !== 'paid' || order.payment_review_status === 'pending' || order.payment_review_status === 'rejected') {
      await answerTelegramCallback(callbackId, '付款/审核完成后才能操作订单', true);
      return res.status(409).json({ success: false, error: 'Payment is not ready' });
    }

    if (!transition.from.includes(order.status)) {
      await answerTelegramCallback(callbackId, `当前状态不可执行此操作：${order.status}`, true);
      return res.status(409).json({ success: false, error: 'Invalid order status transition' });
    }

    await answerTelegramCallback(callbackId, '正在处理订单...');
    callbackAnswered = true;

    await updateOrderByNo(parsed.orderNo, { status: transition.to });

    const updatedOrder = await findOrderByNo(parsed.orderNo);
    if (!updatedOrder) throw new Error('Order disappeared after update');
    const items = await getOrderItems(updatedOrder.id);
    await editTelegramOrderMessage(updatedOrder, items);

    return res.status(200).json({ success: true, status: transition.to });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram webhook failed';
    if (callbackId && !callbackAnswered) await answerTelegramCallback(callbackId, message, true);
    return res.status(400).json({ success: false, error: message });
  }
}

function parseCallbackData(value: string) {
  const [scope, orderNo, action] = value.split(':');
  if (scope !== 'order' || !orderNo || !isTelegramAction(action)) return null;
  return { orderNo, action };
}

function isTelegramAction(value: string): value is TelegramAction {
  return ['confirm', 'start_delivery', 'delivered', 'complete', 'cancel'].includes(value);
}

function isTelegramAdmin(userId: string) {
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return Boolean(userId && adminIds.includes(userId));
}
