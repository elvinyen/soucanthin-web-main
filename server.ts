import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type NextFunction, type Request, type Response } from 'express';

import adminOrderPaymentReview from './api/admin-order-payment-review';
import adminWalletRechargeReview from './api/admin-wallet-recharge-review';
import authLogout from './api/auth-logout';
import authMe from './api/auth-me';
import authRequestOtp from './api/auth-request-otp';
import authVerifyOtp from './api/auth-verify-otp';
import menu from './api/menu';
import order from './api/order';
import paymentConfig from './api/payment-config';
import stripeCheckout from './api/stripe-checkout';
import stripeWebhook from './api/stripe-webhook';
import userAddresses from './api/user-addresses';
import userProfile from './api/user-profile';
import walletRechargeStripe from './api/wallet-recharge-stripe';
import walletRechargeStripeCancel from './api/wallet-recharge-stripe-cancel';
import walletRechargeTng from './api/wallet-recharge-tng';
import walletTransactions from './api/wallet-transactions';
import type { ApiRequest, ApiResponse } from './api/_order-utils';

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const bodyLimit = process.env.BODY_LIMIT || '8mb';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/stripe-webhook', express.raw({ type: '*/*', limit: bodyLimit }), route(stripeWebhook));

app.use('/api', express.json({ limit: bodyLimit }));

app.get('/api/menu', route(menu));
app.post('/api/order', route(order));
app.get('/api/payment-config', route(paymentConfig));
app.post('/api/stripe-checkout', route(stripeCheckout));
app.post('/api/auth/request-otp', route(authRequestOtp));
app.post('/api/auth/verify-otp', route(authVerifyOtp));
app.get('/api/auth/me', route(authMe));
app.post('/api/auth/logout', route(authLogout));
app.route('/api/user/profile')
  .get(route(userProfile))
  .patch(route(userProfile));
app.route('/api/user/addresses')
  .get(route(userAddresses))
  .post(route(userAddresses))
  .patch(route(userAddresses))
  .delete(route(userAddresses));
app.post('/api/wallet/recharge/stripe', route(walletRechargeStripe));
app.post('/api/wallet/recharge/stripe-cancel', route(walletRechargeStripeCancel));
app.post('/api/wallet/recharge/tng', route(walletRechargeTng));
app.get('/api/wallet/transactions', route(walletTransactions));
app.route('/api/admin/order-payment-review')
  .get(route(adminOrderPaymentReview))
  .post(route(adminOrderPaymentReview));
app.route('/api/admin/wallet-recharge-review')
  .get(route(adminWalletRechargeReview))
  .post(route(adminWalletRechargeReview));

app.use(express.static(distDir, {
  index: false,
  maxAge: '1y',
  immutable: true,
  setHeaders(res, filePath) {
    if (!filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.use((_req, res) => {
  const indexPath = path.join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    return res.status(404).json({ success: false, error: 'Frontend build not found' });
  }
  return res.sendFile(indexPath);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Request failed:', error);
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(port, host, () => {
  console.log(`Soup Can Thin Express server listening on http://${host}:${port}`);
});

function route(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req as ApiRequest, res as unknown as ApiResponse);
    } catch (error) {
      next(error);
    }
  };
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}
