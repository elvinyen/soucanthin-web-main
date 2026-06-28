import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ApiRequest,
  ApiResponse,
  findOrderByStripeSession,
  getSupabaseConfig,
  getOrderItems,
  markCouponUsed,
  notifyKitchenFromRecord,
  notifyStaffFromRecord,
  supabaseRequest,
  updateOrderByStripeSession,
} from './_order-utils';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ success: false, error: 'Stripe webhook is not configured' });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = getHeader(req, 'stripe-signature');

    if (!signature || !verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return res.status(400).json({ success: false, error: 'Invalid Stripe signature' });
    }

    const event = JSON.parse(rawBody);
    console.log(`Stripe webhook received: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const sessionId = session?.id;

      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Missing Checkout Session ID' });
      }

      if (session?.metadata?.purpose === 'wallet_recharge') {
        await approveStripeWalletRecharge({
          transactionId: session.metadata.transaction_id,
          sessionId,
          paymentIntentId: session.payment_intent || null,
        });
        return res.status(200).json({ received: true });
      }

      await updateOrderByStripeSession(sessionId, {
        status: 'waiting_kitchen',
        payment_status: 'paid',
        payment_review_status: 'not_required',
        stripe_payment_intent_id: session.payment_intent || null,
        paid_at: new Date().toISOString(),
      });

      const order = await findOrderByStripeSession(sessionId);
      if (order) {
        await markCouponUsed(order.coupon_id || undefined, order.user_id || undefined);
        const items = await getOrderItems(order.id);
        const notification = await notifyStaffFromRecord({
          ...order,
          status: 'waiting_kitchen',
          payment_status: 'paid',
          stripe_payment_intent_id: session.payment_intent || order.stripe_payment_intent_id,
        }, items);
        const kitchenNotification = await notifyKitchenFromRecord({
          ...order,
          status: 'waiting_kitchen',
          payment_status: 'paid',
          stripe_payment_intent_id: session.payment_intent || order.stripe_payment_intent_id,
        }, items);

        await updateOrderByStripeSession(sessionId, {
          notification_status: notification.status,
          notified_at: notification.status === 'sent' ? new Date().toISOString() : null,
          telegram_chat_id: notification.chatId || null,
          telegram_message_id: notification.messageId || null,
          review_tg_chat_id: notification.chatId || null,
          review_tg_message_id: notification.messageId || null,
          kitchen_tg_chat_id: kitchenNotification.chatId || null,
          kitchen_tg_message_id: kitchenNotification.messageId || null,
        });
        console.log(`Stripe order ${order.order_no} notification: ${notification.status}`);
      } else {
        console.warn(`Stripe webhook could not find order for session: ${sessionId}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Stripe webhook failed',
    });
  }
}

async function approveStripeWalletRecharge(params: {
  transactionId?: string;
  sessionId: string;
  paymentIntentId?: string | null;
}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const transactionId = params.transactionId;

  if (!transactionId) {
    console.warn(`Stripe wallet recharge missing transaction id for session: ${params.sessionId}`);
    return;
  }

  await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/approve_wallet_recharge', {
    method: 'POST',
    body: JSON.stringify({
      transaction_id_input: transactionId,
      stripe_session_id_input: params.sessionId,
      stripe_payment_intent_id_input: params.paymentIntentId,
    }),
  });

  console.log(`Stripe wallet recharge approved: ${transactionId}`);
}

async function readRawBody(req: ApiRequest) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');

  if (!req.on) {
    return JSON.stringify(req.body || {});
  }

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on?.('data', chunk => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    req.on?.('end', () => resolve());
    req.on?.('error', error => reject(error));
  });

  return Buffer.concat(chunks).toString('utf8');
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function getHeader(req: ApiRequest, name: string) {
  const headers = req.headers || {};
  const value = headers[name] || headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
