import { randomBytes } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';
import { getAuthenticatedUser, parseJsonBody } from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录' });

  try {
    const body = parseJsonBody<{ amount?: number }>(req.body);
    const amount = validateRechargeAmount(body.amount);
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    if (!stripeSecretKey) throw new Error('Stripe is not configured');

    const transaction = await createPendingStripeTransaction(user.id, amount);
    const checkoutSession = await createStripeWalletCheckout({
      stripeSecretKey,
      siteUrl,
      transactionId: transaction.id,
      userId: user.id,
      amount,
      phone: user.display_phone,
    });

    await updateWalletTransaction(transaction.id, {
      stripe_checkout_session_id: checkoutSession.id,
    });

    return res.status(200).json({
      success: true,
      transactionId: transaction.id,
      checkoutUrl: checkoutSession.url,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '无法创建充值订单',
    });
  }
}

function validateRechargeAmount(value: unknown) {
  const amount = roundMoney(Number(value));
  if (!Number.isFinite(amount) || amount < 5 || amount > 1000) {
    throw new Error('充值金额需介于 RM 5 至 RM 1000');
  }
  return amount;
}

async function createPendingStripeTransaction(userId: string, amount: number) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/wallet_transactions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      type: 'recharge',
      method: 'stripe',
      amount,
      status: 'pending',
      note: `Stripe wallet top up ${randomBytes(3).toString('hex').toUpperCase()}`,
    }),
  });
  const record = Array.isArray(result) ? result[0] : null;
  if (!record?.id) throw new Error('充值记录创建失败');
  return record as { id: string };
}

async function updateWalletTransaction(transactionId: string, payload: Record<string, unknown>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/wallet_transactions?id=eq.${encodeURIComponent(transactionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function createStripeWalletCheckout(params: {
  stripeSecretKey: string;
  siteUrl: string;
  transactionId: string;
  userId: string;
  amount: number;
  phone: string;
}) {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('client_reference_id', params.transactionId);
  body.set('success_url', `${params.siteUrl.replace(/\/$/, '')}/?wallet=stripe-success&tx=${encodeURIComponent(params.transactionId)}`);
  body.set('cancel_url', `${params.siteUrl.replace(/\/$/, '')}/?wallet=stripe-cancel&tx=${encodeURIComponent(params.transactionId)}`);
  body.set('metadata[purpose]', 'wallet_recharge');
  body.set('metadata[transaction_id]', params.transactionId);
  body.set('metadata[user_id]', params.userId);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', 'myr');
  body.set('line_items[0][price_data][unit_amount]', String(Math.round(params.amount * 100)));
  body.set('line_items[0][price_data][product_data][name]', 'Soup Can Thin Wallet Top Up');
  body.set('line_items[0][price_data][product_data][description]', `Wallet recharge for ${params.phone}`);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || 'Unable to create Stripe Checkout Session');
  if (!payload.url || !payload.id) throw new Error('Stripe Checkout Session response is incomplete');
  return payload as { id: string; url: string };
}
