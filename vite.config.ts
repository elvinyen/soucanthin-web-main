import path from 'path';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

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
        if (!requestPath.startsWith('/api/')) {
          return next();
        }

        try {
          const mod = await server.ssrLoadModule('/api/[...path].ts');
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
