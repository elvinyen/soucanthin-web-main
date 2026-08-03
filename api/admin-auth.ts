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
import type { AdminUserRecord } from './_admin-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';
import { getClientIp, recordAdminAudit } from './_admin-audit';

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60_000;
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

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
    if (method === 'GET') return await getMe(req, res);
    if (method === 'POST') return await login(req, res);
    if (method === 'PUT') return await setupFirstAdmin(req, res);
    if (method === 'DELETE') return await logout(req, res);

    res.setHeader?.('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    if ((req.method || 'GET') !== 'GET') await auditAuth(req, false, statusCode, body.error);
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
  const failureKey = `${getClientIp(req)}:${username}`;
  const failure = loginFailures.get(failureKey);
  if (failure?.lockedUntil && failure.lockedUntil > Date.now()) throw new AdminError('登录失败次数过多，请在 15 分钟后重试', 429);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/admin_users?username=eq.${encodeURIComponent(username)}&active=eq.true&select=*`,
    { method: 'GET' },
  );
  const admin = Array.isArray(rows) ? rows[0] as (AdminUserRecord & { password_hash: string }) | undefined : undefined;
  if (!admin?.id || !(await verifyPassword(password, admin.password_hash))) {
    registerLoginFailure(failureKey);
    throw new AdminError('账号或密码不正确', 401);
  }

  loginFailures.delete(failureKey);

  await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_users?id=eq.${encodeURIComponent(admin.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  await createAdminSession(res, admin.id);
  await safeAuditAuth(req, sanitizeAdmin(admin), 'login', true, 200);
  return res.status(200).json({ success: true, admin: sanitizeAdmin(admin) });
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
      branch_scope: 'all',
      active: true,
    }),
  });
  const admin = Array.isArray(created) ? created[0] as { id: string } | undefined : undefined;
  if (!admin?.id) throw new AdminError('管理员账号创建失败');

  await createAdminSession(res, admin.id);
  const currentAdmin = await findAdminById(admin.id);
  if (currentAdmin) await safeAuditAuth(req, sanitizeAdmin(currentAdmin), 'setup_first_admin', true, 201);
  return res.status(201).json({ success: true, admin: currentAdmin && sanitizeAdmin(currentAdmin) });
}

async function logout(req: ApiRequest, res: ApiResponse) {
  const admin = await getAuthenticatedAdmin(req);
  await destroyAdminSession(req, res);
  await safeAuditAuth(req, admin, 'logout', true, 200);
  return res.status(200).json({ success: true });
}

function registerLoginFailure(key: string) {
  const current = loginFailures.get(key);
  const count = (current?.lockedUntil && current.lockedUntil > Date.now() ? current.count : 0) + 1;
  loginFailures.set(key, { count, lockedUntil: count >= LOGIN_MAX_FAILURES ? Date.now() + LOGIN_LOCK_MS : 0 });
}

async function auditAuth(req: ApiRequest, success: boolean, statusCode: number, errorMessage?: string) {
  await safeAuditAuth(req, null, (req.method || 'POST') === 'PUT' ? 'setup_first_admin' : 'login', success, statusCode, errorMessage);
}

async function safeAuditAuth(
  req: ApiRequest,
  admin: Awaited<ReturnType<typeof getAuthenticatedAdmin>>,
  action: string,
  success: boolean,
  statusCode: number,
  errorMessage?: string,
) {
  try {
    await recordAdminAudit({ req, admin, module: 'auth', action, success, statusCode, errorMessage });
  } catch (error) {
    console.error('[audit] failed to record authentication event', error);
  }
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
  const path = `/admin_users?id=eq.${encodeURIComponent(id)}`;
  let rows: unknown;
  try {
    rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `${path}&select=id,username,display_name,role,active,assigned_branch_id,branch_scope,last_login_at`,
      { method: 'GET' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!message.includes('assigned_branch_id') && !message.includes('branch_scope')) throw error;
    rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `${path}&select=id,username,display_name,role,active,last_login_at`,
      { method: 'GET' },
    );
  }
  return Array.isArray(rows) ? rows[0] : null;
}
