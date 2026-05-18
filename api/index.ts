import type { ApiRequest, ApiResponse } from '../server/api/_order-utils';
import adminOrderPaymentReviewHandler from '../server/api/admin-order-payment-review';
import adminWalletRechargeReviewHandler from '../server/api/admin-wallet-recharge-review';
import authLogoutHandler from '../server/api/auth-logout';
import authMeHandler from '../server/api/auth-me';
import authRequestOtpHandler from '../server/api/auth-request-otp';
import authVerifyOtpHandler from '../server/api/auth-verify-otp';
import menuHandler from '../server/api/menu';
import orderHandler from '../server/api/order';
import paymentConfigHandler from '../server/api/payment-config';
import stripeCheckoutHandler from '../server/api/stripe-checkout';
import stripeWebhookHandler from '../server/api/stripe-webhook';
import userAddressesHandler from '../server/api/user-addresses';
import userProfileHandler from '../server/api/user-profile';
import walletRechargeStripeCancelHandler from '../server/api/wallet-recharge-stripe-cancel';
import walletRechargeStripeHandler from '../server/api/wallet-recharge-stripe';
import walletRechargeTngHandler from '../server/api/wallet-recharge-tng';
import walletTransactionsHandler from '../server/api/wallet-transactions';

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

const handlers: Record<string, Handler> = {
  '/api/menu': menuHandler,
  '/api/order': orderHandler,
  '/api/payment-config': paymentConfigHandler,
  '/api/stripe-checkout': stripeCheckoutHandler,
  '/api/stripe-webhook': stripeWebhookHandler,
  '/api/auth/request-otp': authRequestOtpHandler,
  '/api/auth/verify-otp': authVerifyOtpHandler,
  '/api/auth/me': authMeHandler,
  '/api/auth/logout': authLogoutHandler,
  '/api/user/profile': userProfileHandler,
  '/api/user/addresses': userAddressesHandler,
  '/api/wallet/recharge/stripe': walletRechargeStripeHandler,
  '/api/wallet/recharge/stripe-cancel': walletRechargeStripeCancelHandler,
  '/api/wallet/recharge/tng': walletRechargeTngHandler,
  '/api/wallet/transactions': walletTransactionsHandler,
  '/api/admin/order-payment-review': adminOrderPaymentReviewHandler,
  '/api/admin/wallet-recharge-review': adminWalletRechargeReviewHandler,
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const requestPath = getRequestPath(req);
  const routeHandler = handlers[requestPath];

  if (!routeHandler) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }

  try {
    req.body = await readRawBody(req);
    return routeHandler(req, res);
  } catch (error) {
    console.error(`[api] ${requestPath}`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API route failed',
    });
  }
}

function getRequestPath(req: ApiRequest) {
  const url = new URL(req.url || '/', 'http://localhost');
  const rewrittenPath = url.searchParams.get('path');
  if (rewrittenPath) {
    return `/api/${rewrittenPath.replace(/^\/|\/$/g, '')}`;
  }

  return url.pathname.replace(/\/$/, '') || '/';
}

async function readRawBody(req: ApiRequest) {
  if (!req.on) return '';

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
