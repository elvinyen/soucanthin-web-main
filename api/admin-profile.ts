import {
  AdminError,
  createAdminSession,
  hashPassword,
  jsonError,
  parseAdminBody,
  requireAdminRole,
  verifyPassword,
} from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type PasswordInput = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

type PasswordRow = {
  id: string;
  password_hash?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if ((req.method || 'GET') !== 'PATCH') {
      res.setHeader?.('Allow', 'PATCH');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const admin = await requireAdminRole(req, ['admin', 'customer_service', 'kitchen']);
    const input = parseAdminBody<PasswordInput>(req.body);
    const currentPassword = String(input.currentPassword || '');
    const newPassword = String(input.newPassword || '');
    const confirmPassword = String(input.confirmPassword || '');

    if (!currentPassword) throw new AdminError('请输入当前密码');
    if (newPassword.length < 8) throw new AdminError('新密码至少需要 8 位');
    if (newPassword.length > 128) throw new AdminError('新密码不能超过 128 位');
    if (confirmPassword && confirmPassword !== newPassword) throw new AdminError('两次输入的新密码不一致');
    if (currentPassword === newPassword) throw new AdminError('新密码不能与当前密码相同');

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/admin_users?id=eq.${encodeURIComponent(admin.id)}&active=eq.true&select=id,password_hash`,
      { method: 'GET' },
    );
    const account = Array.isArray(rows) ? rows[0] as PasswordRow | undefined : undefined;
    if (!account?.id || !account.password_hash) throw new AdminError('账号不存在或已停用', 403);
    if (!await verifyPassword(currentPassword, account.password_hash)) throw new AdminError('当前密码不正确', 403);

    await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_users?id=eq.${encodeURIComponent(admin.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        password_hash: await hashPassword(newPassword),
        updated_at: new Date().toISOString(),
      }),
    });

    // Revoke every previous session, then issue a fresh session for this device.
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_sessions?admin_user_id=eq.${encodeURIComponent(admin.id)}`, {
      method: 'DELETE',
    });
    await createAdminSession(res, admin.id);

    return res.status(200).json({ success: true });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}
