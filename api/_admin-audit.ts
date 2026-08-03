import { randomUUID } from 'node:crypto';
import type { AdminRole } from './_admin-utils';
import type { ApiRequest } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type AuditAdmin = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  branchScope?: 'all' | 'assigned';
  assignedBranchId?: string | null;
};

type AuditInput = {
  req: ApiRequest;
  admin?: AuditAdmin | null;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  success: boolean;
  statusCode: number;
  errorMessage?: string | null;
  metadata?: unknown;
  requestId?: string;
};

const SENSITIVE_KEYS = /(password|secret|token|cookie|authorization|hash|dataBase64|receiptImage|setupToken|otp|activationCode|phone|address|email|accountNumber|paymentDetails)/i;

export async function recordAdminAudit(input: AuditInput) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const body = sanitizeAuditValue(input.metadata ?? input.req.body);
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/admin_audit_logs', {
    method: 'POST',
    body: JSON.stringify({
      request_id: input.requestId || randomUUID(),
      admin_user_id: input.admin?.id || null,
      username_snapshot: input.admin?.username || readUsername(input.req.body) || 'anonymous',
      display_name_snapshot: input.admin?.displayName || null,
      role_snapshot: input.admin?.role || null,
      branch_id_snapshot: input.admin?.assignedBranchId || null,
      branch_scope_snapshot: input.admin?.branchScope || null,
      module: cleanText(input.module, 80),
      action: cleanText(input.action, 100),
      target_type: cleanText(input.targetType, 80) || null,
      target_id: cleanText(input.targetId, 160) || null,
      http_method: cleanText(input.req.method || 'GET', 12),
      request_path: cleanText(requestUrl(input.req).split('?')[0], 240),
      request_data: body,
      success: input.success,
      status_code: input.statusCode,
      error_message: cleanText(input.errorMessage, 500) || null,
      ip_address: cleanText(getClientIp(input.req), 80) || null,
      user_agent: cleanText(readHeader(input.req, 'user-agent'), 500) || null,
    }),
  });
}

export function describeAdminRequest(req: ApiRequest) {
  const path = requestUrl(req).split('?')[0];
  const module = path.includes('/kitchen/') ? 'kitchen' : path.split('/').filter(Boolean).slice(2, 3)[0] || 'admin';
  const body = asRecord(req.body);
  const action = String(body.action || path.split('/').filter(Boolean).at(-1) || req.method || 'request');
  const targetId = String(body.id || body.orderId || body.userId || body.agentId || body.applicationId || body.payoutId || '').trim();
  return { module, action, targetId: targetId || null };
}

export function shouldAuditAdminRequest(req: ApiRequest) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = requestUrl(req).split('?')[0];
  if (path === '/api/admin/auth') return false;
  if (method !== 'GET') return true;
  if (path === '/api/kitchen/orders' || path === '/api/kitchen/status') return false;
  return true;
}

export function getClientIp(req: ApiRequest) {
  const forwarded = readHeader(req, 'x-forwarded-for');
  return (forwarded.split(',')[0] || req.ip || req.socket?.remoteAddress || '').trim();
}

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]';
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value ?? null;
  if (typeof value === 'string') return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitizeAuditValue(item, depth + 1));
  if (typeof value !== 'object') return String(value);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.test(key) ? '[redacted]' : sanitizeAuditValue(item, depth + 1),
  ]));
}

function readHeader(req: ApiRequest, name: string) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return String(Array.isArray(value) ? value[0] || '' : value || '');
}

function readUsername(body: unknown) {
  return cleanText(asRecord(body).username, 80);
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requestUrl(req: ApiRequest) {
  return req.originalUrl || req.url || '';
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}
