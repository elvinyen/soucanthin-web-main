import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

const scrypt = promisify(scryptCallback);
const ADMIN_SESSION_COOKIE = 'sct_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const PASSWORD_KEY_LENGTH = 64;

export type AdminUserRecord = {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole | LegacyAdminRole;
  active: boolean;
  password_hash?: string;
  last_login_at?: string | null;
};

export type AdminRole = 'admin' | 'kitchen' | 'customer_service' | 'delivery';
type LegacyAdminRole = 'owner' | 'manager' | 'staff';

export async function requireAdmin(req: ApiRequest) {
  return requireAdminRole(req, ['admin']);
}

export async function requireAdminRole(req: ApiRequest, allowedRoles: AdminRole[]) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) throw new AdminError('请先登录后台', 401);
  if (!allowedRoles.includes(admin.role)) throw new AdminError('没有权限访问此功能', 403);
  return admin;
}

export async function getAuthenticatedAdmin(req: ApiRequest) {
  const token = readCookie(req, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const tokenHash = hashSessionToken(token);
  const sessions = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/admin_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*,admin_users(id,username,display_name,role,active)`,
    { method: 'GET' },
  );
  const session = Array.isArray(sessions) ? sessions[0] as { id: string; admin_users?: AdminUserRecord } | undefined : undefined;
  const admin = session?.admin_users;
  if (!session?.id || !admin?.id || !admin.active) return null;

  await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_sessions?id=eq.${encodeURIComponent(session.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  });

  return sanitizeAdmin(admin);
}

export async function createAdminSession(res: ApiResponse, adminUserId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  await supabaseRequest(supabaseUrl, serviceRoleKey, '/admin_sessions', {
    method: 'POST',
    body: JSON.stringify({
      admin_user_id: adminUserId,
      token_hash: hashSessionToken(token),
      expires_at: expiresAt,
    }),
  });

  res.setHeader?.('Set-Cookie', serializeCookie(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_MAX_AGE_SECONDS));
}

export async function destroyAdminSession(req: ApiRequest, res: ApiResponse) {
  const token = readCookie(req, ADMIN_SESSION_COOKIE);
  if (token) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/admin_sessions?token_hash=eq.${encodeURIComponent(hashSessionToken(token))}`,
      { method: 'DELETE' },
    );
  }
  res.setHeader?.('Set-Cookie', serializeCookie(ADMIN_SESSION_COOKIE, '', 0));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, expectedKey] = storedHash.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedKey) return false;

  const key = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  const expected = Buffer.from(expectedKey, 'base64url');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function validateAdminCredentials(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
    throw new AdminError('账号需为 3-32 位，可包含小写字母、数字、点、下划线或横线');
  }
  if (password.length < 8) throw new AdminError('密码至少需要 8 位');
  return normalizedUsername;
}

export function sanitizeAdmin(admin: AdminUserRecord) {
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.display_name,
    role: normalizeAdminRole(admin.role),
  };
}

export function normalizeAdminRole(role: string): AdminRole {
  if (role === 'kitchen') return 'kitchen';
  if (role === 'customer_service') return 'customer_service';
  if (role === 'delivery') return 'delivery';
  return 'admin';
}

export class AdminError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function parseQuery(url?: string) {
  const queryText = url?.includes('?') ? url.slice(url.indexOf('?')) : '';
  return new URLSearchParams(queryText);
}

export function parseAdminBody<T>(body: unknown): T {
  if (!body) return {} as T;
  if (Buffer.isBuffer(body)) {
    const text = body.toString('utf8').trim();
    return text ? JSON.parse(text) as T : {} as T;
  }
  if (typeof body === 'string') {
    return body.trim() ? JSON.parse(body) as T : {} as T;
  }
  return body as T;
}

export function jsonError(error: unknown) {
  const statusCode = error instanceof AdminError ? error.statusCode : 400;
  const message = normalizeAdminErrorMessage(error);
  return { statusCode, body: { success: false, error: message } };
}

function normalizeAdminErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '后台操作失败';
  try {
    const payload = JSON.parse(message) as { code?: string; message?: string };
    if (payload.code === 'PGRST303') {
      return 'Supabase 服务密钥时间无效：JWT 签发时间在未来。请检查 SUPABASE_SERVICE_ROLE_KEY 是否正确、运行机器时间是否同步，然后重启后台服务。';
    }
    return payload.message || message;
  } catch {
    return message;
  }
}

function readHeader(req: ApiRequest, name: string) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readCookie(req: ApiRequest, name: string) {
  const cookieHeader = readHeader(req, 'cookie') || '';
  const cookies = cookieHeader.split(';').map(item => item.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find(item => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

function hashSessionToken(token: string) {
  return createHmac('sha256', getAdminSessionSecret()).update(token).digest('hex');
}

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.includes('replace-with')) throw new AdminError('后台 session secret 未配置', 500);
  return secret;
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
