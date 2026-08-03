import type { ApiRequest, ApiResponse } from './_order-utils';
import {
  AuthError,
  createOtpChallenge,
  getAuthenticatedUser,
  normalizeMalaysiaPhone,
  parseJsonBody,
  type OtpPurpose,
} from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody<{ phone?: string; purpose?: OtpPurpose }>(req.body);
    const purpose = body.purpose === 'update_phone' ? 'update_phone' : 'login';
    const { phone, displayPhone } = normalizeMalaysiaPhone(body.phone || '');
    const user = purpose === 'update_phone' ? await getAuthenticatedUser(req) : null;
    if (purpose === 'update_phone' && !user) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    const challenge = await createOtpChallenge(req, phone, displayPhone, purpose, user?.id || null);

    return res.status(200).json({
      success: true,
      ...challenge,
    });
  } catch (error) {
    const statusCode = error instanceof AuthError ? error.statusCode : 400;
    if (statusCode === 429) res.setHeader?.('Retry-After', '60');
    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : '无法发送验证码',
    });
  }
}
