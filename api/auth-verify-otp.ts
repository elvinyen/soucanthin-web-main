import type { ApiRequest, ApiResponse } from './_order-utils';
import {
  createSession,
  findOrCreateUser,
  getWallet,
  mapUser,
  normalizeMalaysiaPhone,
  parseJsonBody,
  setSessionCookie,
  verifyMoceanOtp,
} from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody<{ phone?: string; reqid?: string; code?: string }>(req.body);
    const { phone, displayPhone } = normalizeMalaysiaPhone(body.phone || '');
    const code = String(body.code || '').trim();
    const reqid = String(body.reqid || '').trim();

    if (!reqid) return res.status(400).json({ success: false, error: '缺少验证码请求编号' });
    if (!/^\d{4,6}$/.test(code)) return res.status(400).json({ success: false, error: '请输入正确的验证码' });

    try {
      await verifyMoceanOtp(reqid, code);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : '验证码不正确或已过期',
      });
    }

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
