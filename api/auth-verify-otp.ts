import type { ApiRequest, ApiResponse } from './_order-utils';
import {
  createSession,
  findOrCreateUser,
  getWallet,
  mapUser,
  parseJsonBody,
  setSessionCookie,
  verifyOtpChallenge,
} from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody<{ challengeId?: string; code?: string }>(req.body);
    const code = String(body.code || '').trim();
    const challengeId = String(body.challengeId || '').trim();

    if (!challengeId) return res.status(400).json({ success: false, error: '缺少验证码请求编号' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, error: '请输入 6 位验证码' });

    const { phone, displayPhone } = await verifyOtpChallenge({ challengeId, code, purpose: 'login' });

    const user = await findOrCreateUser(phone, displayPhone);
    const token = await createSession(user.id);
    const wallet = await getWallet(user.id);

    setSessionCookie(res, token);
    return res.status(200).json({
      success: true,
      authenticated: true,
      user: mapUser(user),
      wallet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
    const friendlyMessage = message === 'Supabase is not configured'
      ? '验证码已通过，但会员系统的 Supabase 尚未配置完成'
      : message;

    return res.status(400).json({
      success: false,
      error: friendlyMessage,
    });
  }
}
