import path from 'path';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const localApiRoutes: Array<{ pattern: RegExp; modulePath: string; routePath: string }> = [
  { pattern: /^\/api\/menu$/, modulePath: '/api/menu.ts', routePath: 'menu' },
  { pattern: /^\/api\/order$/, modulePath: '/api/order.ts', routePath: 'order' },
  { pattern: /^\/api\/payment-config$/, modulePath: '/api/payment.ts', routePath: 'payment-config' },
  { pattern: /^\/api\/stripe-checkout$/, modulePath: '/api/payment.ts', routePath: 'stripe-checkout' },
  { pattern: /^\/api\/stripe-webhook$/, modulePath: '/api/payment.ts', routePath: 'stripe-webhook' },
  { pattern: /^\/api\/auth\/(.+)$/, modulePath: '/api/auth.ts', routePath: '$1' },
  { pattern: /^\/api\/user\/(.+)$/, modulePath: '/api/user.ts', routePath: '$1' },
  { pattern: /^\/api\/wallet\/(.+)$/, modulePath: '/api/wallet.ts', routePath: '$1' },
  { pattern: /^\/api\/admin\/(.+)$/, modulePath: '/api/admin.ts', routePath: '$1' },
];

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
      server.middlewares.use(async (req, res, next) => {
        const requestPath = (req.url || '').split('?')[0];
        const route = findLocalApiRoute(requestPath);
        if (!route) {
          return next();
        }

        try {
          const originalUrl = req.url || '';
          const separator = originalUrl.includes('?') ? '&' : '?';
          req.url = `${originalUrl}${separator}path=${encodeURIComponent(route.routePath)}`;
          const mod = await server.ssrLoadModule(route.modulePath);
          const response = createDevResponse(res);

          await mod.default(req, response);
        } catch (error) {
          console.error(`[dev-api] ${requestPath}`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Local API failed' }));
          }
        }
      });
  },
  };
}

function findLocalApiRoute(requestPath: string) {
  for (const route of localApiRoutes) {
    const match = requestPath.match(route.pattern);
    if (match) {
      return {
        modulePath: route.modulePath,
        routePath: route.routePath.replace('$1', match[1] || ''),
      };
    }
  }
  return null;
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
