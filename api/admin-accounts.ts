import {
  AdminError,
  hashPassword,
  jsonError,
  normalizeAdminRole,
  parseAdminBody,
  requireAdmin,
  validateAdminCredentials,
} from './_admin-utils';
import type { AdminRole, AdminUserRecord } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type AccountInput = {
  id?: string;
  username?: string;
  password?: string;
  displayName?: string;
  role?: AdminRole;
  active?: boolean;
};

type AccountRow = AdminUserRecord & {
  created_at?: string | null;
  updated_at?: string | null;
};

const ACCOUNT_SELECT = 'id,username,display_name,role,active,last_login_at,created_at,updated_at';
const MANAGED_ROLES: AdminRole[] = ['admin', 'customer_service', 'kitchen', 'delivery'];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const currentAdmin = await requireAdmin(req);
    const method = req.method || 'GET';

    if (method === 'GET') return await listAccounts(res);
    if (method === 'POST') return await createAccount(req, res);
    if (method === 'PATCH' || method === 'PUT') return await updateAccount(req, res, currentAdmin.id);
    if (method === 'DELETE') return await deleteAccount(req, res, currentAdmin.id);

    res.setHeader?.('Allow', 'GET, POST, PATCH, PUT, DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function listAccounts(res: ApiResponse) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/admin_users?select=${ACCOUNT_SELECT}&order=created_at.desc`,
    { method: 'GET' },
  );

  return res.status(200).json({
    success: true,
    accounts: (Array.isArray(rows) ? rows as AccountRow[] : []).map(mapAccount),
  });
}

async function createAccount(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<AccountInput>(req.body);
  const password = String(input.password || '');
  const username = validateAdminCredentials(String(input.username || ''), password);
  const role = normalizeManagedRole(String(input.role || 'kitchen'));
  const displayName = normalizeDisplayName(input.displayName, username);
  const passwordHash = await hashPassword(password);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/admin_users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      username,
      password_hash: passwordHash,
      display_name: displayName,
      role,
      active: input.active !== false,
    }),
  });
  const account = Array.isArray(created) ? created[0] as AccountRow | undefined : created as AccountRow | undefined;
  if (!account?.id) throw new AdminError('账号创建失败', 500);

  return res.status(201).json({ success: true, account: mapAccount(account) });
}

async function updateAccount(req: ApiRequest, res: ApiResponse, currentAdminId: string) {
  const input = parseAdminBody<AccountInput>(req.body);
  const id = String(input.id || '').trim();
  if (!id) throw new AdminError('缺少账号 ID');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await findAccountById(id);
  if (!existing) throw new AdminError('账号不存在', 404);

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let usernameChanged = false;
  let roleChanged = false;
  let passwordChanged = false;
  if (input.username !== undefined) {
    const nextUsername = String(input.username || '').trim().toLowerCase();
    if (nextUsername !== existing.username) {
      payload.username = validateUsername(nextUsername);
      usernameChanged = true;
    }
  }
  if (input.displayName !== undefined) payload.display_name = normalizeDisplayName(input.displayName, existing.username);
  if (input.role !== undefined) {
    const nextRole = normalizeManagedRole(String(input.role));
    if (id === currentAdminId && nextRole !== 'admin') throw new AdminError('不能修改当前登录账号的管理员角色', 400);
    payload.role = nextRole;
    roleChanged = nextRole !== normalizeAdminRole(existing.role);
  }
  if (input.active !== undefined) {
    if (id === currentAdminId && input.active === false) throw new AdminError('不能停用当前登录账号', 400);
    payload.active = Boolean(input.active);
  }
  if (input.password !== undefined && String(input.password).length > 0) {
    const password = String(input.password);
    if (password.length < 8) throw new AdminError('密码至少需要 8 位');
    payload.password_hash = await hashPassword(password);
    passwordChanged = true;
  }
  if (Object.keys(payload).length === 1) throw new AdminError('没有可更新的字段');

  const updated = await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_users?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const account = Array.isArray(updated) ? updated[0] as AccountRow | undefined : updated as AccountRow | undefined;
  if (!account?.id) throw new AdminError('账号更新失败', 500);

  if (usernameChanged || roleChanged || passwordChanged || input.active === false) {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_sessions?admin_user_id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  return res.status(200).json({ success: true, account: mapAccount(account) });
}

async function deleteAccount(req: ApiRequest, res: ApiResponse, currentAdminId: string) {
  const input = parseAdminBody<AccountInput>(req.body);
  const id = String(input.id || '').trim();
  if (!id) throw new AdminError('缺少账号 ID');
  if (id === currentAdminId) throw new AdminError('不能删除当前登录账号');

  const account = await findAccountById(id);
  if (!account) throw new AdminError('账号不存在', 404);
  if (normalizeAdminRole(account.role) === 'admin' && account.active) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const adminRows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/admin_users?role=eq.admin&active=eq.true&select=id',
      { method: 'GET' },
    );
    if (Array.isArray(adminRows) && adminRows.length <= 1) throw new AdminError('至少需要保留一个启用的管理员账号');
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_users?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.status(200).json({ success: true });
}

async function findAccountById(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/admin_users?id=eq.${encodeURIComponent(id)}&select=${ACCOUNT_SELECT}`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] as AccountRow | undefined : undefined;
}

function normalizeManagedRole(value: string): AdminRole {
  if (!MANAGED_ROLES.includes(value as AdminRole)) throw new AdminError('账号角色不正确');
  return value as AdminRole;
}

function normalizeDisplayName(value: unknown, fallback: string) {
  return String(value || fallback).trim().slice(0, 60) || fallback;
}

function validateUsername(value: string) {
  if (!/^[a-z0-9._-]{3,32}$/.test(value)) {
    throw new AdminError('账号需为 3-32 位，可包含小写字母、数字、点、下划线或横线');
  }
  return value;
}

function mapAccount(account: AccountRow) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    role: normalizeAdminRole(account.role),
    active: account.active,
    lastLoginAt: account.last_login_at || null,
    createdAt: account.created_at || null,
    updatedAt: account.updated_at || null,
  };
}
