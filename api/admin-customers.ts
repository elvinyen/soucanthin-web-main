import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import { ensureWallet, normalizeMalaysiaPhone, type UserRecord } from './_auth-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type CustomerInput = {
  phone?: string;
  name?: string;
};

type CustomerRow = UserRecord & {
  updated_at?: string | null;
};

const CUSTOMER_SELECT = 'id,phone,display_phone,name,email,birthday,source,created_by_admin_id,created_at,last_login_at';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';

    if (method === 'GET') return await listCustomers(req, res);
    if (method === 'POST') return await createCustomer(req, res, admin.id);

    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function listCustomers(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const search = String(query.get('search') || query.get('q') || '').trim();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const filters = [`select=${CUSTOMER_SELECT}`, 'order=created_at.desc', 'limit=30'];

  const searchOr = search ? buildCustomerSearchOr(search) : '';
  if (searchOr) {
    filters.push(`or=${encodeURIComponent(searchOr)}`);
  }

  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/users?${filters.join('&')}`,
    { method: 'GET' },
  );

  return res.status(200).json({
    success: true,
    customers: (Array.isArray(rows) ? rows as CustomerRow[] : []).map(mapCustomer),
  });
}

async function createCustomer(req: ApiRequest, res: ApiResponse, adminId: string) {
  const input = parseAdminBody<CustomerInput>(req.body);
  const { phone, displayPhone } = normalizeMalaysiaPhone(String(input.phone || ''));
  const name = normalizeCustomerName(input.name);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const existingRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/users?phone=eq.${encodeURIComponent(phone)}&select=${CUSTOMER_SELECT}`,
    { method: 'GET' },
  );
  const existing = Array.isArray(existingRows) ? existingRows[0] as CustomerRow | undefined : undefined;
  if (existing?.id) {
    await ensureWallet(existing.id);
    return res.status(409).json({
      success: false,
      error: '该手机号已存在，请直接选择已有顾客',
      customer: mapCustomer(existing),
    });
  }

  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/users', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      phone,
      display_phone: displayPhone,
      name,
      source: 'admin_created',
      created_by_admin_id: adminId,
    }),
  });
  const customer = Array.isArray(created) ? created[0] as CustomerRow | undefined : created as CustomerRow | undefined;
  if (!customer?.id) throw new AdminError('顾客创建失败', 500);

  await ensureWallet(customer.id);
  return res.status(201).json({ success: true, customer: mapCustomer(customer) });
}

function buildCustomerSearchOr(search: string) {
  const terms = new Set<string>();
  terms.add(search);
  const digits = search.replace(/\D/g, '');
  if (digits) terms.add(digits);

  try {
    const normalized = normalizeMalaysiaPhone(search);
    terms.add(normalized.phone);
    terms.add(normalized.displayPhone);
  } catch {
    // Free-text name search should still work when the input is not a phone number.
  }

  const safeTerms = Array.from(terms).map(term => sanitizePostgrestPattern(term)).filter(Boolean);
  const parts = safeTerms.flatMap(term => [
    `phone.ilike.*${term}*`,
    `display_phone.ilike.*${term}*`,
    `name.ilike.*${term}*`,
  ]);
  if (parts.length === 0) return '';
  return `(${parts.join(',')})`;
}

function sanitizePostgrestPattern(value: string) {
  return value.trim().replace(/[(),]/g, '').slice(0, 80);
}

function normalizeCustomerName(value: unknown) {
  const name = String(value || '').trim();
  if (!name) throw new AdminError('请填写顾客姓名');
  if (name.length > 60) throw new AdminError('顾客姓名不能超过 60 个字符');
  return name;
}

function mapCustomer(customer: CustomerRow) {
  return {
    id: customer.id,
    phone: customer.phone,
    displayPhone: customer.display_phone,
    name: customer.name || '',
    email: customer.email || null,
    birthday: customer.birthday || null,
    source: customer.source || 'otp',
    createdByAdminId: customer.created_by_admin_id || null,
    createdAt: customer.created_at,
    lastLoginAt: customer.last_login_at || null,
  };
}
