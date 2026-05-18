import type { ApiRequest, ApiResponse } from '../server/api/_order-utils';

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;
type HandlerLoader = () => Promise<{ default: Handler }>;

const handlers: Record<string, HandlerLoader> = {
  '/api/menu': () => import('../server/api/menu'),
  '/api/order': () => import('../server/api/order'),
  '/api/payment-config': () => import('../server/api/payment-config'),
  '/api/stripe-checkout': () => import('../server/api/stripe-checkout'),
  '/api/stripe-webhook': () => import('../server/api/stripe-webhook'),
  '/api/auth/request-otp': () => import('../server/api/auth-request-otp'),
  '/api/auth/verify-otp': () => import('../server/api/auth-verify-otp'),
  '/api/auth/me': () => import('../server/api/auth-me'),
  '/api/auth/logout': () => import('../server/api/auth-logout'),
  '/api/user/profile': () => import('../server/api/user-profile'),
  '/api/user/addresses': () => import('../server/api/user-addresses'),
  '/api/wallet/recharge/stripe': () => import('../server/api/wallet-recharge-stripe'),
  '/api/wallet/recharge/stripe-cancel': () => import('../server/api/wallet-recharge-stripe-cancel'),
  '/api/wallet/recharge/tng': () => import('../server/api/wallet-recharge-tng'),
  '/api/wallet/transactions': () => import('../server/api/wallet-transactions'),
  '/api/admin/order-payment-review': () => import('../server/api/admin-order-payment-review'),
  '/api/admin/wallet-recharge-review': () => import('../server/api/admin-wallet-recharge-review'),
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const requestPath = getRequestPath(req);
  const loadRouteHandler = handlers[requestPath];

  if (!loadRouteHandler) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }

  try {
    req.body = await readRawBody(req);
    const routeHandler = (await loadRouteHandler()).default;
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
