import { AdminError, enforceAdminBranch, hasAllBranchAccess, jsonError, parseAdminBody, requireAdmin, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type StoreBranchInput = {
  id?: string;
  name?: string;
  address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  active?: boolean;
  sort_order?: number | string;
  opening_minute?: number | string;
  closing_minute?: number | string;
};

type StoreBranchRow = {
  id: string;
  name: string;
  address: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  active: boolean;
  sort_order: number;
  opening_minute?: number | null;
  closing_minute?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const BRANCH_SELECT = 'id,name,address,latitude,longitude,active,sort_order,opening_minute,closing_minute,created_at,updated_at';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const method = req.method || 'GET';

    if (method === 'GET') {
      const admin = await requireAdminRole(req, ['admin', 'customer_service']);
      return await listBranches(res, admin);
    }
    if (method === 'POST') {
      await requireAdmin(req);
      return await createBranch(req, res);
    }
    if (method === 'PATCH' || method === 'PUT') {
      const admin = await requireAdminRole(req, ['admin', 'customer_service']);
      return await updateBranch(req, res, admin);
    }

    res.setHeader?.('Allow', 'GET, POST, PATCH, PUT');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function createBranch(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<StoreBranchInput>(req.body);
  const id = String(input.id || '').trim().toLowerCase();
  if (!id) throw new AdminError('门店 ID 必填');
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(id)) throw new AdminError('门店 ID 只能使用小写字母、数字、横线或下划线');
  if (await findBranchById(id)) throw new AdminError('门店 ID 已存在');

  const payload: Record<string, unknown> = {
    ...normalizeBranchPayload(input, {
      id,
      name: '',
      address: '',
      active: true,
      sort_order: 0,
      opening_minute: 1020,
      closing_minute: 240,
    }),
    id,
  };
  if (!payload.name) throw new AdminError('门店名称必填');
  if (!payload.address) throw new AdminError('门店地址必填');
  if (payload.active === undefined) payload.active = true;
  if (payload.sort_order === undefined) payload.sort_order = 0;

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/store_branches', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const branch = Array.isArray(created) ? created[0] as StoreBranchRow | undefined : created as StoreBranchRow | undefined;
  if (!branch?.id) throw new AdminError('门店新增失败', 500);
  return res.status(201).json({ success: true, branch: mapBranch(branch) });
}

async function listBranches(res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const branchFilter = hasAllBranchAccess(admin) ? '' : `id=eq.${encodeURIComponent(enforceAdminBranch(admin) || '')}&`;
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?${branchFilter}select=${BRANCH_SELECT}&order=sort_order.asc,id.asc`,
    { method: 'GET' },
  );

  return res.status(200).json({
    success: true,
    branches: (Array.isArray(rows) ? rows as StoreBranchRow[] : []).map(mapBranch),
  });
}

async function updateBranch(req: ApiRequest, res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  const input = parseAdminBody<StoreBranchInput>(req.body);
  if (admin.role !== 'admin' && (input.active !== undefined || input.sort_order !== undefined || input.opening_minute !== undefined || input.closing_minute !== undefined)) {
    throw new AdminError('运营助理只能修改门店名称、地址和坐标', 403);
  }
  const id = String(input.id || '').trim();
  if (!id) throw new AdminError('缺少门店 ID');
  enforceAdminBranch(admin, id);

  const existing = await findBranchById(id);
  if (!existing) throw new AdminError('门店不存在', 404);

  const payload = normalizeBranchPayload(input, existing);
  if (!Object.keys(payload).length) throw new AdminError('没有可更新的字段');

  if (payload.active === false && existing.active) {
    await ensureAnotherActiveBranch(id);
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const updated = await supabaseRequest(supabaseUrl, serviceRoleKey, `/store_branches?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const branch = Array.isArray(updated) ? updated[0] as StoreBranchRow | undefined : updated as StoreBranchRow | undefined;
  if (!branch?.id) throw new AdminError('门店更新失败', 500);

  return res.status(200).json({ success: true, branch: mapBranch(branch) });
}

async function findBranchById(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?id=eq.${encodeURIComponent(id)}&select=${BRANCH_SELECT}`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? rows[0] as StoreBranchRow | undefined : undefined;
}

async function ensureAnotherActiveBranch(id: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?active=eq.true&id=neq.${encodeURIComponent(id)}&select=id&limit=1`,
    { method: 'GET' },
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AdminError('至少需要保留一个启用门店');
  }
}

function normalizeBranchPayload(input: StoreBranchInput, existing: StoreBranchRow) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new AdminError('门店名称必填');
    if (name.length > 80) throw new AdminError('门店名称不能超过 80 个字符');
    payload.name = name;
  }

  let addressChanged = false;
  if (input.address !== undefined) {
    const address = String(input.address).trim();
    if (!address) throw new AdminError('门店地址必填');
    if (address.length > 240) throw new AdminError('门店地址不能超过 240 个字符');
    payload.address = address;
    addressChanged = address !== existing.address;
  }

  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;
  if (hasLatitude || hasLongitude) {
    if (hasLatitude) payload.latitude = normalizeCoordinate(input.latitude, '纬度', -90, 90);
    if (hasLongitude) payload.longitude = normalizeCoordinate(input.longitude, '经度', -180, 180);
  } else if (addressChanged) {
    payload.latitude = null;
    payload.longitude = null;
  }

  if (input.active !== undefined) payload.active = Boolean(input.active);

  if (input.sort_order !== undefined) {
    const sortOrder = Number(input.sort_order);
    if (!Number.isInteger(sortOrder)) throw new AdminError('排序必须是整数');
    payload.sort_order = sortOrder;
  }

  const hasOpeningMinute = input.opening_minute !== undefined;
  const hasClosingMinute = input.closing_minute !== undefined;
  if (hasOpeningMinute || hasClosingMinute) {
    const openingMinute = hasOpeningMinute ? normalizeMinute(input.opening_minute, '开始营业时间') : Number(existing.opening_minute ?? 1020);
    const closingMinute = hasClosingMinute ? normalizeMinute(input.closing_minute, '结束营业时间') : Number(existing.closing_minute ?? 240);
    if (openingMinute === closingMinute) throw new AdminError('开始和结束营业时间不能相同');
    if (hasOpeningMinute) payload.opening_minute = openingMinute;
    if (hasClosingMinute) payload.closing_minute = closingMinute;
  }

  return payload;
}

function normalizeMinute(value: StoreBranchInput['opening_minute'], label: string) {
  const minute = Number(value);
  if (!Number.isInteger(minute) || minute < 0 || minute >= 24 * 60) throw new AdminError(`${label}无效`);
  return minute;
}

function normalizeCoordinate(value: StoreBranchInput['latitude'], label: string, min: number, max: number) {
  if (value === null || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    throw new AdminError(`${label}必须是有效数字`);
  }
  return numberValue;
}

function mapBranch(branch: StoreBranchRow) {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    latitude: branch.latitude === null || branch.latitude === undefined ? null : Number(branch.latitude),
    longitude: branch.longitude === null || branch.longitude === undefined ? null : Number(branch.longitude),
    active: branch.active,
    sort_order: branch.sort_order,
    opening_minute: Number(branch.opening_minute ?? 1020),
    closing_minute: Number(branch.closing_minute ?? 240),
    created_at: branch.created_at || null,
    updated_at: branch.updated_at || null,
  };
}
