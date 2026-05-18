import type { ApiRequest, ApiResponse } from '../server/api/_order-utils.ts';

export type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

export async function dispatchRoute(
  req: ApiRequest,
  res: ApiResponse,
  handlers: Record<string, Handler>,
) {
  const route = getRoute(req);
  const handler = handlers[route];

  if (!handler) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }

  try {
    req.body = await readRawBody(req);
    return handler(req, res);
  } catch (error) {
    console.error(`[api] ${route}`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API route failed',
    });
  }
}

function getRoute(req: ApiRequest) {
  const url = new URL(req.url || '/', 'http://localhost');
  const rewrittenPath = url.searchParams.get('path');
  if (rewrittenPath) return rewrittenPath.replace(/^\/|\/$/g, '');
  return url.pathname.replace(/^\/api\/?|\/$/g, '') || 'index';
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
