import { AdminError, jsonError, parseQuery, requireAdmin } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

const SELECT = 'id,request_id,admin_user_id,username_snapshot,display_name_snapshot,role_snapshot,branch_id_snapshot,branch_scope_snapshot,module,action,target_type,target_id,http_method,request_path,request_data,success,status_code,error_message,ip_address,user_agent,created_at';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    await requireAdmin(req);
    if ((req.method || 'GET') !== 'GET') throw new AdminError('Method not allowed', 405);
    const query = parseQuery(req.url);
    const filters = [`select=${SELECT}`, 'order=created_at.desc', `limit=${normalizeLimit(query.get('limit'))}`];
    addFilter(filters, 'admin_user_id', query.get('adminUserId'));
    addFilter(filters, 'role_snapshot', query.get('role'));
    addFilter(filters, 'branch_id_snapshot', query.get('branchId'));
    addFilter(filters, 'module', query.get('module'));
    if (query.get('success') === 'true' || query.get('success') === 'false') filters.push(`success=eq.${query.get('success')}`);
    const from = normalizeDate(query.get('from'));
    const to = normalizeDate(query.get('to'));
    if (from) filters.push(`created_at=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`created_at=lte.${encodeURIComponent(to)}`);
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/admin_audit_logs?${filters.join('&')}`, { method: 'GET' });
    return res.status(200).json({ success: true, logs: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

function addFilter(filters: string[], column: string, value: string | null) {
  const clean = String(value || '').trim();
  if (clean && clean !== 'all') filters.push(`${column}=eq.${encodeURIComponent(clean)}`);
}

function normalizeLimit(value: string | null) {
  const limit = Number(value || 200);
  return Number.isInteger(limit) && limit >= 1 && limit <= 500 ? limit : 200;
}

function normalizeDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
