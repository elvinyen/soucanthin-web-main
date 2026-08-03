import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type AdminMenuCategory = {
  id?: number;
  label?: string;
  sort_order?: number;
  active?: boolean;
};

type CategoryRow = {
  id: number;
  label: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';

    if (method === 'GET') return await listCategories(res);
    if (method === 'POST') return await createCategory(req, res);
    if (method === 'PUT' || method === 'PATCH') return await updateCategory(req, res);
    if (method === 'DELETE') return await deleteCategory(req, res);

    res.setHeader?.('Allow', 'GET, POST, PUT, PATCH, DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function listCategories(res: ApiResponse) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const [categories, items] = await Promise.all([
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_categories?select=id,label,sort_order,active,created_at,updated_at&order=sort_order.asc,id.asc',
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_items?select=category_id',
      { method: 'GET' },
    ),
  ]);

  const counts = new Map<number, number>();
  if (Array.isArray(items)) {
    items.forEach(item => {
      const categoryId = Number((item as { category_id?: number }).category_id);
      if (Number.isInteger(categoryId)) counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });
  }

  return res.status(200).json({
    success: true,
    categories: (Array.isArray(categories) ? categories : []).map(category => ({
      ...(category as CategoryRow),
      item_count: counts.get(Number((category as CategoryRow).id)) || 0,
    })),
  });
}

async function createCategory(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<AdminMenuCategory>(req.body);
  const payload = normalizeCategoryPayload(input, true);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/menu_categories', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  return res.status(201).json({ success: true, category: Array.isArray(created) ? created[0] : created });
}

async function updateCategory(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const input = parseAdminBody<AdminMenuCategory>(req.body);
  const id = Number(input.id || query.get('id'));
  if (!Number.isInteger(id) || id <= 0) throw new AdminError('缺少有效分类 ID');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existingRows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_categories?id=eq.${encodeURIComponent(String(id))}&select=id,label`,
    { method: 'GET' },
  );
  const existing = Array.isArray(existingRows) ? existingRows[0] as CategoryRow | undefined : undefined;
  if (!existing?.id) throw new AdminError('分类不存在', 404);

  const payload = normalizeCategoryPayload(input, false);
  if (!Object.keys(payload).length) throw new AdminError('没有可更新的字段');

  const updated = await supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_categories?id=eq.${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  return res.status(200).json({ success: true, category: Array.isArray(updated) ? updated[0] : updated });
}

async function deleteCategory(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const input = parseAdminBody<{ id?: number }>(req.body);
  const id = Number(input.id || query.get('id'));
  if (!Number.isInteger(id) || id <= 0) throw new AdminError('缺少有效分类 ID');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const categories = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_categories?id=eq.${encodeURIComponent(String(id))}&select=id,label`,
    { method: 'GET' },
  );
  const category = Array.isArray(categories) ? categories[0] as CategoryRow | undefined : undefined;
  if (!category?.id) throw new AdminError('分类不存在', 404);

  const usedItems = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?category_id=eq.${encodeURIComponent(String(category.id))}&select=id&limit=1`,
    { method: 'GET' },
  );
  if (Array.isArray(usedItems) && usedItems.length > 0) {
    throw new AdminError('该分类下还有菜品，请先调整菜品分类后再删除');
  }

  await supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_categories?id=eq.${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

  return res.status(200).json({ success: true });
}

function normalizeCategoryPayload(input: AdminMenuCategory, isCreate: boolean) {
  const payload: Record<string, unknown> = {};

  if (input.label !== undefined) {
    const label = String(input.label).trim();
    if (!label) throw new AdminError('分类名称必填');
    if (label.length > 40) throw new AdminError('分类名称不能超过 40 个字符');
    payload.label = label;
  } else if (isCreate) {
    throw new AdminError('分类名称必填');
  }

  if (input.sort_order !== undefined) {
    const sortOrder = Number(input.sort_order);
    if (!Number.isInteger(sortOrder)) throw new AdminError('排序必须是整数');
    payload.sort_order = sortOrder;
  }

  if (typeof input.active === 'boolean') payload.active = input.active;

  return payload;
}
