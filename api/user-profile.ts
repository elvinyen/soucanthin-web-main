import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';
import { getAuthenticatedUser, mapUser, normalizeMalaysiaPhone, parseJsonBody, verifyMoceanOtp } from './_auth-utils';

type ProfileBody = {
  name?: string | null;
  email?: string | null;
  birthday?: string | null;
  phone?: string | null;
  phoneReqid?: string | null;
  phoneCode?: string | null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'PATCH') {
    res.setHeader?.('Allow', 'PATCH');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录' });

  try {
    const body = parseJsonBody<ProfileBody>(req.body);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const birthday = String(body.birthday || '').trim();
    const phoneInput = String(body.phone || '').trim();
    const phoneReqid = String(body.phoneReqid || '').trim();
    const phoneCode = String(body.phoneCode || '').trim();

    if (name.length > 60) throw new Error('用户名称不能超过 60 个字符');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式不正确');
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw new Error('生日格式不正确');

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const updatePayload: Record<string, string | null> = {
      name: name || null,
      email: email || null,
      birthday: birthday || null,
    };

    if (phoneInput) {
      const { phone, displayPhone } = normalizeMalaysiaPhone(phoneInput);
      if (phone !== user.phone) {
        if (!phoneReqid) throw new Error('请先获取新手机号码验证码');
        if (!/^\d{4,6}$/.test(phoneCode)) throw new Error('请输入正确的验证码');

        const existing = await supabaseRequest(
          supabaseUrl,
          serviceRoleKey,
          `/users?phone=eq.${encodeURIComponent(phone)}&select=id`,
          { method: 'GET' },
        );
        const existingUser = Array.isArray(existing) ? existing[0] as { id?: string } | undefined : undefined;
        if (existingUser?.id && existingUser.id !== user.id) throw new Error('该手机号码已被其他用户使用');

        await verifyMoceanOtp(phoneReqid, phoneCode);
        updatePayload.phone = phone;
        updatePayload.display_phone = displayPhone;
      }
    }

    const updated = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(updatePayload),
      },
    );
    const nextUser = Array.isArray(updated) ? updated[0] : null;
    if (!nextUser?.id) throw new Error('用户资料保存失败');

    return res.status(200).json({ success: true, user: mapUser(nextUser) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '无法保存用户资料',
    });
  }
}
