import path from 'path';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const apiRoutes: Record<string, string> = {
  '/api/menu': '/api/menu.ts',
  '/api/store-status': '/api/store-status.ts',
  '/api/address-autocomplete': '/api/address-autocomplete.ts',
  '/api/address-place-details': '/api/address-place-details.ts',
  '/api/delivery-quote': '/api/delivery-quote.ts',
  '/api/delivery-approval': '/api/delivery-approval.ts',
  '/api/order': '/api/order.ts',
  '/api/payment-config': '/api/payment-config.ts',
  '/api/telegram/webhook': '/api/telegram-webhook.ts',
  '/api/stripe-checkout': '/api/stripe-checkout.ts',
  '/api/stripe-order-cancel': '/api/stripe-order-cancel.ts',
  '/api/stripe-webhook': '/api/stripe-webhook.ts',
  '/api/auth/request-otp': '/api/auth-request-otp.ts',
  '/api/auth/verify-otp': '/api/auth-verify-otp.ts',
  '/api/auth/me': '/api/auth-me.ts',
  '/api/auth/logout': '/api/auth-logout.ts',
  '/api/user/profile': '/api/user-profile.ts',
  '/api/agent': '/api/agent.ts',
  '/api/user/addresses': '/api/user-addresses.ts',
  '/api/wallet/recharge/stripe': '/api/wallet-recharge-stripe.ts',
  '/api/wallet/recharge/stripe-cancel': '/api/wallet-recharge-stripe-cancel.ts',
  '/api/wallet/recharge/tng': '/api/wallet-recharge-tng.ts',
  '/api/wallet/transactions': '/api/wallet-transactions.ts',
  '/api/admin/order-payment-review': '/api/admin-order-payment-review.ts',
  '/api/admin/wallet-recharge-review': '/api/admin-wallet-recharge-review.ts',
  '/api/admin/auth': '/api/admin-auth.ts',
  '/api/admin/audit-logs': '/api/admin-audit-logs.ts',
  '/api/admin/accounts': '/api/admin-accounts.ts',
  '/api/admin/profile': '/api/admin-profile.ts',
  '/api/admin/agents': '/api/admin-agents.ts',
  '/api/admin/customers': '/api/admin-customers.ts',
  '/api/admin/users': '/api/admin-users.ts',
  '/api/admin/coupons': '/api/admin-coupons.ts',
  '/api/admin/delivery': '/api/admin-delivery.ts',
  '/api/admin/delivery-approvals': '/api/admin-delivery-approvals.ts',
  '/api/admin/delivery-settings': '/api/admin-delivery-settings.ts',
  '/api/admin/finance': '/api/admin-finance.ts',
  '/api/admin/menu-categories': '/api/admin-menu-categories.ts',
  '/api/admin/menu-image': '/api/admin-menu-image.ts',
  '/api/admin/menu-items': '/api/admin-menu-items.ts',
  '/api/admin/orders': '/api/admin-orders.ts',
  '/api/admin/store-branches': '/api/admin-store-branches.ts',
  '/api/kitchen/orders': '/api/kitchen-orders.ts',
  '/api/kitchen/menu': '/api/kitchen-menu.ts',
  '/api/kitchen/status': '/api/kitchen-orders.ts',
  '/api/kitchen/orders/start': '/api/kitchen-orders.ts',
  '/api/kitchen/orders/complete': '/api/kitchen-orders.ts',
  '/api/kitchen/orders/stock-issue': '/api/kitchen-orders.ts',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  Object.assign(process.env, env);

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), localApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

function localApiPlugin() {
  return {
    name: 'local-api-middleware',
    configureServer(server: ViteDevServer) {
    Object.entries(apiRoutes).forEach(([route, modulePath]) => {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = (req.url || '').split('?')[0];
        if (requestPath !== route) {
          return next();
        }

        try {
          const mod = await server.ssrLoadModule(modulePath);
          const body = await readBody(req);
          const contentType = req.headers['content-type'] || '';
          const shouldKeepRawBody = route === '/api/stripe-webhook';
          const request = Object.assign(req, {
            body: !shouldKeepRawBody && contentType.includes('application/json') && body.length
              ? JSON.parse(body.toString('utf8'))
              : body,
          });
          const response = createDevResponse(res);

          await mod.default(request, response);
        } catch (error) {
          console.error(`[dev-api] ${route}`, error);
          if (!res.headersSent) {
            const message = error instanceof Error ? error.message : 'Local API failed';
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: message || 'Local API failed' }));
          }
        }
      });
    });
  },
  };
}

function readBody(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function createDevResponse(res: import('node:http').ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value);
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(body));
    },
    end(body?: unknown) {
      res.end(body);
    },
  };
}
