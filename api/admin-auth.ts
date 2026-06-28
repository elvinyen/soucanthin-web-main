import {
  AdminError,
  createAdminSession,
  destroyAdminSession,
  getAuthenticatedAdmin,
  hashPassword,
  jsonError,
  parseAdminBody,
  sanitizeAdmin,
  validateAdminCredentials,
  verifyPassword,
} from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type LoginBody = {
  username?: string;
  password?: string;
};

type SetupBody = LoginBody & {
  displayName?: string;
  setupToken?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const method = req.method || 'GET';
    if (method === 'GET') return getMe(req, res);
    if (method === 'POST') return login(req, res);
    if (method === 'PUT') return setupFirstAdmin(req, res);
    if (method === 'DELETE') return logout(req, res);

    res.setHeader?.('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getMe(req: ApiRequest, res: ApiResponse) {
  const admin = await getAuthenticatedAdmin(req);
  const hasAdmins = await adminUserExists();
  return res.status(200).json({ success: true, authenticated: Boolean(admin), admin, setupRequired: !hasAdmins });
}

async function login(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<LoginBody>(req.body);
  const username = validateAdminCredentials(String(input.username || ''), String(input.password || ''));
  const password = String(input.password || '');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/admin_users?username=eq.${encodeURIComponent(username)}&active=eq.true&select=*`,
    { method: 'GET' },
  );
  const admin = Array.isArray(rows) ? rows[0] as { id: string; password_hash: string } | undefined : undefined;
  if (!admin?.id || !(await verifyPassword(password, admin.password_hash))) {
    throw new AdminError('账号或密码不正确', 401);
  }

  await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_users?id=eq.${encodeURIComponent(admin.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  await createAdminSession(res, admin.id);
  const currentAdmin = await findAdminById(admin.id);
  return res.status(200).json({ success: true, admin: currentAdmin && sanitizeAdmin(currentAdmin) });
}

async function setupFirstAdmin(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<SetupBody>(req.body);
  if (!process.env.ADMIN_REVIEW_TOKEN || input.setupToken !== process.env.ADMIN_REVIEW_TOKEN) {
    throw new AdminError('初始化 token 不正确', 401);
  }
  if (await adminUserExists()) throw new AdminError('管理员账号已经初始化', 409);

  const username = validateAdminCredentials(String(input.username || ''), String(input.password || ''));
  const passwordHash = await hashPassword(String(input.password || ''));
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/admin_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      username,
      password_hash: passwordHash,
      display_name: String(input.displayName || username).trim() || username,
      role: 'admin',
      active: true,
    }),
  });
  const admin = Array.isArray(created) ? created[0] as { id: string } | undefined : undefined;
  if (!admin?.id) throw new AdminError('管理员账号创建失败');

  await createAdminSession(res, admin.id);
  const currentAdmin = await findAdminById(admin.id);
  return res.status(201).json({ success: true, admin: currentAdmin && sanitizeAdmin(currentAdmin) });
}

async function logout(req: ApiRequest, res: ApiResponse) {
  await destroyAdminSession(req, res);
  return res.status(200).json({ success: true });
}

async function adminUserExists() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    '/admin_users?select=id&limit=1',
    { method: 'GET' },
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function findAdminById(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/admin_users?id=eq.${encodeURIComponent(id)}&select=id,username,display_name,role,active,last_login_at`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] : null;
}
