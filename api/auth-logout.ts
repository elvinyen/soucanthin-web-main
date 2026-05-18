import type { ApiRequest, ApiResponse } from './_order-utils';
import { clearSessionCookie, destroySession } from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    await destroySession(req);
  } catch (error) {
    console.error('Logout cleanup failed:', error);
  }

  clearSessionCookie(res);
  return res.status(200).json({ success: true, authenticated: false });
}
