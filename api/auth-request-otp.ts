import type { ApiRequest, ApiResponse } from './_order-utils';
import { normalizeMalaysiaPhone, parseJsonBody, requestMoceanOtp } from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody<{ phone?: string }>(req.body);
    const { phone, displayPhone } = normalizeMalaysiaPhone(body.phone || '');
    const reqid = await requestMoceanOtp(phone);

    return res.status(200).json({
      success: true,
      reqid,
      phone,
      displayPhone,
      expiresIn: 300,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '无法发送验证码',
    });
  }
}
