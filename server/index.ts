import { config as loadEnv } from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';

import adminAuth from '../api/admin-auth';
import adminAccounts from '../api/admin-accounts';
import adminCustomers from '../api/admin-customers';
import adminDelivery from '../api/admin-delivery';
import adminMenuImage from '../api/admin-menu-image';
import adminOrderPaymentReview from '../api/admin-order-payment-review';
import adminMenuCategories from '../api/admin-menu-categories';
import adminMenuItems from '../api/admin-menu-items';
import adminOrders from '../api/admin-orders';
import adminStoreBranches from '../api/admin-store-branches';
import adminWalletRechargeReview from '../api/admin-wallet-recharge-review';
import addressAutocomplete from '../api/address-autocomplete';
import addressPlaceDetails from '../api/address-place-details';
import authLogout from '../api/auth-logout';
import authMe from '../api/auth-me';
import authRequestOtp from '../api/auth-request-otp';
import authVerifyOtp from '../api/auth-verify-otp';
import deliveryQuote from '../api/delivery-quote';
import menu from '../api/menu';
import order from '../api/order';
import paymentConfig from '../api/payment-config';
import stripeCheckout from '../api/stripe-checkout';
import stripeWebhook from '../api/stripe-webhook';
import telegramWebhook from '../api/telegram-webhook';
import userAddresses from '../api/user-addresses';
import userProfile from '../api/user-profile';
import kitchenOrders from '../api/kitchen-orders';
import walletRechargeStripe from '../api/wallet-recharge-stripe';
import walletRechargeStripeCancel from '../api/wallet-recharge-stripe-cancel';
import walletRechargeTng from '../api/wallet-recharge-tng';
import walletTransactions from '../api/wallet-transactions';
import type { ApiRequest, ApiResponse } from '../api/_order-utils';

const envFile = process.env.ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local');
loadEnv({ path: envFile, override: true });
loadEnv({ override: false });
logSupabaseRuntimeConfig(envFile);

type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

const app = express();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);

app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});

app.all('/api/stripe-webhook', express.raw({ type: '*/*', limit: '2mb' }), runApi(stripeWebhook));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

mount('/api/menu', menu);
mount('/api/address-autocomplete', addressAutocomplete);
mount('/api/address-place-details', addressPlaceDetails);
mount('/api/delivery-quote', deliveryQuote);
mount('/api/order', order);
mount('/api/payment-config', paymentConfig);
mount('/api/telegram/webhook', telegramWebhook);
mount('/api/stripe-checkout', stripeCheckout);
mount('/api/auth/request-otp', authRequestOtp);
mount('/api/auth/verify-otp', authVerifyOtp);
mount('/api/auth/me', authMe);
mount('/api/auth/logout', authLogout);
mount('/api/user/profile', userProfile);
mount('/api/user/addresses', userAddresses);
mount('/api/wallet/recharge/stripe', walletRechargeStripe);
mount('/api/wallet/recharge/stripe-cancel', walletRechargeStripeCancel);
mount('/api/wallet/recharge/tng', walletRechargeTng);
mount('/api/wallet/transactions', walletTransactions);
mount('/api/admin/order-payment-review', adminOrderPaymentReview);
mount('/api/admin/wallet-recharge-review', adminWalletRechargeReview);
mount('/api/admin/auth', adminAuth);
mount('/api/admin/accounts', adminAccounts);
mount('/api/admin/customers', adminCustomers);
mount('/api/admin/delivery', adminDelivery);
mount('/api/admin/menu-categories', adminMenuCategories);
mount('/api/admin/menu-image', adminMenuImage);
mount('/api/admin/menu-items', adminMenuItems);
mount('/api/admin/orders', adminOrders);
mount('/api/admin/store-branches', adminStoreBranches);
mount('/api/kitchen/orders', kitchenOrders);
mount('/api/kitchen/status', kitchenOrders);
mount('/api/kitchen/orders/start', kitchenOrders);
mount('/api/kitchen/orders/complete', kitchenOrders);
mount('/api/kitchen/orders/stock-issue', kitchenOrders);

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (!res.headersSent) {
    if (isBodyParserError(error)) {
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }
    console.error('[api] unhandled error', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.listen(port, host, () => {
  console.log(`API server listening on http://${host}:${port}`);
});

function logSupabaseRuntimeConfig(envFile: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const keyParts = serviceRoleKey.split('.');
  let keyMeta: Record<string, unknown> = { present: Boolean(serviceRoleKey), jwt: keyParts.length >= 2 };

  if (keyParts.length >= 2) {
    try {
      const payload = JSON.parse(Buffer.from(keyParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as {
        iat?: number;
        exp?: number;
        role?: string;
        ref?: string;
      };
      keyMeta = {
        ...keyMeta,
        role: payload.role,
        ref: payload.ref,
        iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
        exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      };
    } catch {
      keyMeta = { ...keyMeta, decode: 'failed' };
    }
  }

  console.log('[config] env', {
    envFile,
    nodeEnv: process.env.NODE_ENV,
    systemTime: new Date().toISOString(),
    supabaseUrlHost: process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null,
    serviceRoleKey: keyMeta,
  });
}

function mount(route: string, handler: ApiHandler) {
  app.all(route, runApi(handler));
}

function runApi(handler: ApiHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req as ApiRequest, res as unknown as ApiResponse);
    } catch (error) {
      next(error);
    }
  };
}

function isBodyParserError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status?: number }).status === 400 &&
    'body' in error,
  );
}
