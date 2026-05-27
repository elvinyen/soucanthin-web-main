import {
  answerTelegramCallback,
  ApiRequest,
  ApiResponse,
  editTelegramOrderMessage,
  findOrderByNo,
  getSupabaseConfig,
  getOrderItems,
  InlineKeyboardMarkup,
  sendTelegramMessage,
  supabaseRequest,
  updateOrderByNo,
} from './_order-utils';
import { parseJsonBody } from './_auth-utils';
import type { OrderStatus } from '../types/order';

type TelegramAction = 'confirm' | 'start_delivery' | 'delivered' | 'complete' | 'cancel';
type TelegramAdminAction = 'add' | 'remove';

type TelegramWebhookPayload = {
  callback_query?: {
    id?: string;
    from?: {
      id?: number;
    };
    message?: {
      chat?: {
        id?: number | string;
      };
    };
    data?: string;
  };
  message?: {
    chat?: {
      id?: number | string;
    };
    from?: TelegramUser;
    text?: string;
  };
};

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramUserRecord = {
  telegram_user_id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_admin: boolean;
  first_seen_at?: string;
  last_seen_at?: string;
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

    if (payload.message) {
      await handleMessage(payload.message);
      return res.status(200).json({ success: true });
    }

    if (!callback) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const adminId = callback.from?.id ? String(callback.from.id) : '';
    if (!(await isTelegramAdmin(adminId))) {
      await answerTelegramCallback(callbackId, '无权限操作此订单', true);
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const adminAction = parseAdminCallbackData(callback.data || '');
    if (adminAction) {
      const chatId = callback.message?.chat?.id ? String(callback.message.chat.id) : process.env.TELEGRAM_CHAT_ID || '';
      await setStoredTelegramAdmin(adminAction.userId, adminAction.action === 'add');
      await answerTelegramCallback(callbackId, adminAction.action === 'add' ? '已设为管理员' : '已取消管理员');
      callbackAnswered = true;
      await sendTelegramAdminList(chatId);
      return res.status(200).json({ success: true });
    }

    const parsed = parseOrderCallbackData(callback.data || '');
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

async function handleMessage(message: NonNullable<TelegramWebhookPayload['message']>) {
  const chatId = message.chat?.id ? String(message.chat.id) : '';
  const user = message.from;
  const userId = user?.id ? String(user.id) : '';
  const text = (message.text || '').trim();

  if (userId) await upsertTelegramUser(user);

  if (text.startsWith('/start')) {
    await sendTelegramMessage(chatId, '已登记。管理员可以在机器人里发送 /admin_users，从已登记用户中设置订单管理员。');
    return;
  }

  if (text.startsWith('/admin_users')) {
    if (!(await isTelegramAdmin(userId))) {
      await sendTelegramMessage(chatId, '无权限查看管理员列表。');
      return;
    }
    await sendTelegramAdminList(chatId);
  }
}

function parseOrderCallbackData(value: string) {
  const [scope, orderNo, action] = value.split(':');
  if (scope !== 'order' || !orderNo || !isTelegramAction(action)) return null;
  return { orderNo, action };
}

function parseAdminCallbackData(value: string) {
  const [scope, userId, action] = value.split(':');
  if (scope !== 'tgadmin' || !userId || !isTelegramAdminAction(action)) return null;
  return { userId, action };
}

function isTelegramAction(value: string): value is TelegramAction {
  return ['confirm', 'start_delivery', 'delivered', 'complete', 'cancel'].includes(value);
}

function isTelegramAdminAction(value: string): value is TelegramAdminAction {
  return ['add', 'remove'].includes(value);
}

async function isTelegramAdmin(userId: string) {
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!userId) return false;
  if (adminIds.includes(userId)) return true;

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const result = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/telegram_users?telegram_user_id=eq.${encodeURIComponent(userId)}&is_admin=eq.true&select=telegram_user_id`,
      { method: 'GET' },
    );
    return Array.isArray(result) && Boolean(result[0]?.telegram_user_id);
  } catch (error) {
    console.error('Telegram admin lookup failed:', error);
    return false;
  }
}

async function upsertTelegramUser(user?: TelegramUser) {
  const userId = user?.id ? String(user.id) : '';
  if (!userId) return;

  const envAdminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/telegram_users?telegram_user_id=eq.${encodeURIComponent(userId)}&select=is_admin`,
    { method: 'GET' },
  );
  const existingAdmin = Array.isArray(existing) ? Boolean(existing[0]?.is_admin) : false;

  await supabaseRequest(supabaseUrl, serviceRoleKey, '/telegram_users?on_conflict=telegram_user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      telegram_user_id: userId,
      username: user?.username || null,
      first_name: user?.first_name || null,
      last_name: user?.last_name || null,
      is_admin: existingAdmin || envAdminIds.includes(userId),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function setStoredTelegramAdmin(userId: string, isAdmin: boolean) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/telegram_users?telegram_user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ is_admin: isAdmin, updated_at: new Date().toISOString() }),
    },
  );
}

async function sendTelegramAdminList(chatId: string) {
  const users = await getStoredTelegramUsers();
  if (!users.length) {
    await sendTelegramMessage(chatId, '还没有用户登记。请让对方先私聊机器人并发送 /start。');
    return;
  }

  const rows = users.map(user => {
    const label = formatTelegramUserLabel(user);
    const action: TelegramAdminAction = user.is_admin ? 'remove' : 'add';
    return [{
      text: `${user.is_admin ? '取消管理员' : '设为管理员'} · ${label}`,
      callback_data: `tgadmin:${user.telegram_user_id}:${action}`,
    }];
  });

  const message = [
    '已登记 Telegram 用户：',
    '',
    ...users.map(user => `${user.is_admin ? '✅' : '▫️'} ${formatTelegramUserLabel(user)} (${user.telegram_user_id})`),
    '',
    '点击下面按钮设置订单管理员。',
  ].join('\n');

  await sendTelegramMessage(chatId, message, { inline_keyboard: rows } satisfies InlineKeyboardMarkup);
}

async function getStoredTelegramUsers() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    '/telegram_users?select=telegram_user_id,username,first_name,last_name,is_admin,first_seen_at,last_seen_at&order=last_seen_at.desc&limit=20',
    { method: 'GET' },
  );
  return Array.isArray(result) ? result as TelegramUserRecord[] : [];
}

function formatTelegramUserLabel(user: TelegramUserRecord) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return user.username ? `@${user.username}` : name || user.telegram_user_id;
}
