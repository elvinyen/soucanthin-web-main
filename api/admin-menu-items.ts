import type { MenuOptionGroup } from '../data/menu';
import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdmin } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type AdminMenuItem = {
  id?: number;
  action?: 'move-up' | 'move-down';
  item_code?: string | null;
  name?: string;
  description?: string;
  detail?: string;
  price?: number;
  category_id?: number;
  category?: string;
  image_url?: string;
  tags?: string[];
  recommended?: boolean;
  sold_out?: boolean;
  active?: boolean;
  sort_order?: number;
  option_groups?: MenuOptionGroup[];
  translations?: Partial<Record<TranslationLang, MenuTranslationInput>>;
};

type CategoryRow = {
  id: number;
  label: string;
};

type TranslationLang = 'en' | 'th' | 'vi';

type MenuTranslationInput = {
  lang?: TranslationLang;
  name?: string;
  description?: string;
  detail?: string;
  category_label?: string | null;
  tags?: string[];
  option_groups?: MenuOptionGroupTranslation[];
};

type MenuOptionGroupTranslation = {
  id: string;
  name: string;
  options: MenuOptionTranslation[];
};

type MenuOptionTranslation = {
  id: string;
  name: string;
};

type MenuTranslationRow = MenuTranslationInput & {
  item_id: number;
  lang: TranslationLang;
};

type SortableMenuItemRow = {
  id: number;
  category_id?: number | null;
  sort_order?: number | null;
};

const SELECT_COLUMNS = 'id,item_code,name,description,detail,price,category_id,image_url,tags,recommended,sold_out,active,sort_order,option_groups,created_at,updated_at';
const TRANSLATION_LANGUAGES: TranslationLang[] = ['en', 'th', 'vi'];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    await requireAdmin(req);
    const method = req.method || 'GET';

    if (method === 'GET') return await listMenuItems(req, res);
    if (method === 'POST') return await createMenuItem(req, res);
    if (method === 'PUT' || method === 'PATCH') return await updateMenuItem(req, res);
    if (method === 'DELETE') return await deleteMenuItem(req, res);

    res.setHeader?.('Allow', 'GET, POST, PUT, PATCH, DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function listMenuItems(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const checkField = query.get('checkField')?.trim();
  if (checkField) return await checkMenuItemDuplicate(req, res);

  const search = query.get('search')?.trim();
  const active = query.get('active');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const filters = [`select=${SELECT_COLUMNS}`, 'order=sort_order.asc,id.asc'];

  if (active === 'true' || active === 'false') filters.push(`active=eq.${active}`);
  if (search) {
    const safeSearch = search.replace(/[%*,()]/g, '');
    filters.push(`or=(name.ilike.*${encodeURIComponent(safeSearch)}*,item_code.ilike.*${encodeURIComponent(safeSearch)}*)`);
  }

  const [rows, categories, translations] = await Promise.all([
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/menu_items?${filters.join('&')}`,
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_categories?select=id,label',
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_item_translations?select=item_id,lang,name,description,detail,category_label,tags,option_groups',
      { method: 'GET' },
    ),
  ]);
  const categoryLabels = new Map<number, string>(
    (Array.isArray(categories) ? categories : []).map(category => [
      Number((category as CategoryRow).id),
      String((category as CategoryRow).label),
    ]),
  );
  const translationsByItem = groupTranslations(Array.isArray(translations) ? translations as MenuTranslationRow[] : []);
  const items = (Array.isArray(rows) ? rows : []).map(row => {
    const item = row as AdminMenuItem;
    return {
      ...item,
      category: categoryLabels.get(Number(item.category_id)) || '',
      translations: translationsByItem.get(Number(item.id)) || {},
    };
  });

  return res.status(200).json({ success: true, items });
}

async function checkMenuItemDuplicate(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const field = query.get('checkField');
  const value = query.get('value')?.trim() || '';
  const excludeId = Number(query.get('excludeId') || 0);
  if (field !== 'item_code' && field !== 'name') throw new AdminError('不支持的查重字段');
  if (!value) return res.status(200).json({ success: true, exists: false });

  const exists = await menuItemDuplicateExists(field, value, Number.isInteger(excludeId) && excludeId > 0 ? excludeId : undefined);
  return res.status(200).json({ success: true, exists });
}

async function createMenuItem(req: ApiRequest, res: ApiResponse) {
  const input = parseAdminBody<AdminMenuItem>(req.body);
  const payload = normalizeMenuPayload(input, true);
  await assertMenuItemUnique(payload);
  await getActiveCategoryById(Number(payload.category_id));
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  payload.sort_order = await getNextSortOrder(Number(payload.category_id));
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/menu_items', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const item = Array.isArray(created) ? created[0] as { id?: number } | undefined : created as { id?: number } | undefined;
  if (item?.id) await saveMenuTranslations(Number(item.id), input.translations);

  return res.status(201).json({ success: true, item: Array.isArray(created) ? created[0] : created });
}

async function updateMenuItem(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const input = parseAdminBody<AdminMenuItem>(req.body);
  const id = Number(input.id || query.get('id'));
  if (!Number.isInteger(id) || id <= 0) throw new AdminError('缺少有效菜品 ID');
  if (input.action === 'move-up' || input.action === 'move-down') {
    return await moveMenuItem(res, id, input.action);
  }

  const payload = normalizeMenuPayload(input, false);
  if (!Object.keys(payload).length && input.translations === undefined) throw new AdminError('没有可更新的字段');
  await assertMenuItemUnique(payload, id);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const currentItem = await getSortableMenuItem(id);
  if (payload.category_id !== undefined) {
    await getActiveCategoryById(Number(payload.category_id));
    if (Number(payload.category_id) !== Number(currentItem.category_id)) {
      payload.sort_order = await getNextSortOrder(Number(payload.category_id));
    }
  }

  const updated = Object.keys(payload).length
    ? await supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_items?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
    : [];
  await saveMenuTranslations(id, input.translations);

  return res.status(200).json({ success: true, item: Array.isArray(updated) ? updated[0] : updated });
}

async function moveMenuItem(res: ApiResponse, id: number, action: 'move-up' | 'move-down') {
  const currentItem = await getSortableMenuItem(id);
  const categoryId = Number(currentItem.category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new AdminError('当前菜品缺少分类，无法排序');
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?category_id=eq.${encodeURIComponent(String(categoryId))}&select=id,category_id,sort_order&order=sort_order.asc,id.asc`,
    { method: 'GET' },
  );
  const siblings = Array.isArray(rows) ? rows as SortableMenuItemRow[] : [];
  const currentIndex = siblings.findIndex(item => Number(item.id) === id);
  if (currentIndex < 0) throw new AdminError('菜品不存在');

  const targetIndex = action === 'move-up' ? currentIndex - 1 : currentIndex + 1;
  const targetItem = siblings[targetIndex];
  if (!targetItem) {
    return res.status(200).json({ success: true, moved: false });
  }

  const currentSort = Number(currentItem.sort_order ?? 0);
  const targetSort = Number(targetItem.sort_order ?? 0);
  const nextCurrentSort = currentSort === targetSort
    ? targetSort + (action === 'move-up' ? -1 : 1)
    : targetSort;

  await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_items?id=eq.${encodeURIComponent(String(currentItem.id))}`, {
      method: 'PATCH',
      body: JSON.stringify({ sort_order: nextCurrentSort }),
    }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_items?id=eq.${encodeURIComponent(String(targetItem.id))}`, {
      method: 'PATCH',
      body: JSON.stringify({ sort_order: currentSort }),
    }),
  ]);

  return res.status(200).json({ success: true, moved: true });
}

async function deleteMenuItem(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const input = parseAdminBody<{ id?: number; hardDelete?: boolean }>(req.body);
  const id = Number(input.id || query.get('id'));
  if (!Number.isInteger(id) || id <= 0) throw new AdminError('缺少有效菜品 ID');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (input.hardDelete || query.get('hardDelete') === 'true') {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_items?id=eq.${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  } else {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/menu_items?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
  }

  return res.status(200).json({ success: true });
}

function normalizeMenuPayload(input: AdminMenuItem, isCreate: boolean) {
  const payload: Record<string, unknown> = {};

  if (!isCreate && input.id !== undefined) {
    const id = Number(input.id);
    if (!Number.isInteger(id) || id <= 0) throw new AdminError('菜品 ID 必须是正整数');
  }

  setText(payload, input, 'item_code', false, true);
  setText(payload, input, 'name', isCreate);
  setText(payload, input, 'description', isCreate);
  setText(payload, input, 'detail', isCreate);
  setText(payload, input, 'image_url', isCreate);

  if (input.category_id !== undefined) {
    const categoryId = Number(input.category_id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) throw new AdminError('请选择有效分类');
    payload.category_id = categoryId;
  } else if (isCreate) {
    throw new AdminError('分类必填');
  }

  if (input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new AdminError('价格格式不正确');
    payload.price = Number(price.toFixed(2));
  } else if (isCreate) {
    throw new AdminError('价格必填');
  }

  if (Array.isArray(input.tags)) payload.tags = input.tags.map(tag => String(tag).trim()).filter(Boolean);
  if (typeof input.recommended === 'boolean') payload.recommended = input.recommended;
  if (typeof input.sold_out === 'boolean') payload.sold_out = input.sold_out;
  if (typeof input.active === 'boolean') payload.active = input.active;
  if (input.option_groups !== undefined) payload.option_groups = normalizeOptionGroups(input.option_groups);

  return payload;
}

function groupTranslations(rows: MenuTranslationRow[]) {
  const grouped = new Map<number, Partial<Record<TranslationLang, MenuTranslationInput>>>();
  rows.forEach(row => {
    const itemId = Number(row.item_id);
    const itemTranslations = grouped.get(itemId) || {};
    itemTranslations[row.lang] = {
      name: row.name || '',
      description: row.description || '',
      detail: row.detail || '',
      category_label: row.category_label || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
      option_groups: Array.isArray(row.option_groups) ? row.option_groups : [],
    };
    grouped.set(itemId, itemTranslations);
  });
  return grouped;
}

async function saveMenuTranslations(itemId: number, translations: AdminMenuItem['translations'] | undefined) {
  if (translations === undefined) return;

  const rowsToUpsert: MenuTranslationRow[] = [];
  const langsToDelete: TranslationLang[] = [];

  TRANSLATION_LANGUAGES.forEach(lang => {
    const input = translations[lang];
    if (!input || isEmptyTranslation(input)) {
      langsToDelete.push(lang);
      return;
    }
    rowsToUpsert.push(normalizeTranslation(itemId, lang, input));
  });

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await Promise.all(langsToDelete.map(lang => supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_item_translations?item_id=eq.${encodeURIComponent(String(itemId))}&lang=eq.${encodeURIComponent(lang)}`,
    { method: 'DELETE' },
  )));

  if (rowsToUpsert.length) {
    await supabaseRequest(supabaseUrl, serviceRoleKey, '/menu_item_translations?on_conflict=item_id,lang', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rowsToUpsert),
    });
  }
}

async function assertMenuItemUnique(payload: Record<string, unknown>, excludeId?: number) {
  if (payload.item_code !== undefined && payload.item_code !== null && String(payload.item_code).trim()) {
    const exists = await menuItemDuplicateExists('item_code', String(payload.item_code), excludeId);
    if (exists) throw new AdminError('菜品编码已存在，请更换编码', 409);
  }
  if (payload.name !== undefined && String(payload.name).trim()) {
    const exists = await menuItemDuplicateExists('name', String(payload.name), excludeId);
    if (exists) throw new AdminError('菜品名称已存在，请更换名称', 409);
  }
}

async function menuItemDuplicateExists(field: 'item_code' | 'name', value: string, excludeId?: number) {
  const normalized = value.trim();
  if (!normalized) return false;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const filters = [
    'select=id',
    field === 'item_code'
      ? `item_code=eq.${encodeURIComponent(normalized)}`
      : `name=ilike.${encodeURIComponent(normalized)}`,
    'limit=1',
  ];
  if (excludeId) filters.push(`id=neq.${encodeURIComponent(String(excludeId))}`);
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?${filters.join('&')}`,
    { method: 'GET' },
  );
  return Array.isArray(rows) && rows.length > 0;
}

function normalizeTranslation(itemId: number, lang: TranslationLang, input: MenuTranslationInput): MenuTranslationRow {
  return {
    item_id: itemId,
    lang,
    name: normalizeRequiredText(input.name, `${labelLanguage(lang)}名称`),
    description: normalizeRequiredText(input.description, `${labelLanguage(lang)}简介`),
    detail: normalizeRequiredText(input.detail, `${labelLanguage(lang)}详情`),
    category_label: String(input.category_label || '').trim() || null,
    tags: Array.isArray(input.tags) ? input.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
    option_groups: normalizeTranslationOptionGroups(input.option_groups || [], lang),
  };
}

function isEmptyTranslation(input: MenuTranslationInput) {
  return !String(input.name || '').trim()
    && !String(input.description || '').trim()
    && !String(input.detail || '').trim()
    && !String(input.category_label || '').trim()
    && (!Array.isArray(input.tags) || input.tags.every(tag => !String(tag || '').trim()))
    && (!Array.isArray(input.option_groups) || input.option_groups.every(group => (
      !String(group?.name || '').trim()
      && (!Array.isArray(group?.options) || group.options.every(option => !String(option?.name || '').trim()))
    )));
}

function normalizeTranslationOptionGroups(value: unknown, lang: TranslationLang) {
  if (!Array.isArray(value)) throw new AdminError(`${labelLanguage(lang)}规格/加料翻译必须是数组`);
  return value.map((rawGroup, groupIndex) => {
    if (!isRecord(rawGroup)) throw new AdminError(`${labelLanguage(lang)}第 ${groupIndex + 1} 个规格组翻译格式不正确`);
    const id = normalizeOptionId(rawGroup.id, `${labelLanguage(lang)}第 ${groupIndex + 1} 个规格组 ID`);
    const name = String(rawGroup.name || '').trim();
    if (!Array.isArray(rawGroup.options)) throw new AdminError(`${labelLanguage(lang)}第 ${groupIndex + 1} 个规格组选项翻译必须是数组`);
    return {
      id,
      name,
      options: rawGroup.options.map((rawOption, optionIndex) => {
        if (!isRecord(rawOption)) throw new AdminError(`${labelLanguage(lang)}第 ${groupIndex + 1} 个规格组的第 ${optionIndex + 1} 个选项翻译格式不正确`);
        return {
          id: normalizeOptionId(rawOption.id, `${labelLanguage(lang)}第 ${groupIndex + 1} 个规格组的第 ${optionIndex + 1} 个选项 ID`),
          name: String(rawOption.name || '').trim(),
        };
      }),
    };
  });
}

function labelLanguage(lang: TranslationLang) {
  return {
    en: '英文',
    th: '泰文',
    vi: '越南语',
  }[lang];
}

async function getSortableMenuItem(id: number) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?id=eq.${encodeURIComponent(String(id))}&select=id,category_id,sort_order&limit=1`,
    { method: 'GET' },
  );
  const item = Array.isArray(rows) ? rows[0] as SortableMenuItemRow | undefined : undefined;
  if (!item?.id) throw new AdminError('菜品不存在', 404);
  return item;
}

async function getNextSortOrder(categoryId: number) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?category_id=eq.${encodeURIComponent(String(categoryId))}&select=sort_order&order=sort_order.desc,id.desc&limit=1`,
    { method: 'GET' },
  );
  const lastItem = Array.isArray(rows) ? rows[0] as { sort_order?: number | null } | undefined : undefined;
  return Number(lastItem?.sort_order ?? 0) + 10;
}

async function getActiveCategoryById(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new AdminError('请选择有效分类');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_categories?id=eq.${encodeURIComponent(String(id))}&active=eq.true&select=id,label`,
    { method: 'GET' },
  );
  const category = Array.isArray(rows) ? rows[0] as CategoryRow | undefined : undefined;
  if (!category?.id) {
    throw new AdminError('请选择有效的上架分类');
  }
  return category;
}

function setText(
  payload: Record<string, unknown>,
  input: AdminMenuItem,
  key: keyof AdminMenuItem,
  required: boolean,
  nullable = false,
) {
  const value = input[key];
  if (value === undefined) {
    if (required) throw new AdminError(`${fieldLabel(key)}必填`);
    return;
  }

  const text = String(value).trim();
  if (!text && required) throw new AdminError(`${fieldLabel(key)}必填`);
  payload[key] = text || (nullable ? null : '');
}

function fieldLabel(key: keyof AdminMenuItem) {
  const labels: Partial<Record<keyof AdminMenuItem, string>> = {
    name: '中文名称',
    description: '简介',
    detail: '详情',
    image_url: '图片链接',
  };
  return labels[key] || String(key);
}

function normalizeOptionGroups(value: unknown) {
  if (!Array.isArray(value)) throw new AdminError('规格/加料必须是数组');

  const groupIds = new Set<string>();
  return value.map((rawGroup, groupIndex) => {
    if (!isRecord(rawGroup)) throw new AdminError(`第 ${groupIndex + 1} 个规格组格式不正确`);

    const id = normalizeOptionId(rawGroup.id, `第 ${groupIndex + 1} 个规格组 ID`);
    if (groupIds.has(id)) throw new AdminError(`规格组 ID「${id}」重复`);
    groupIds.add(id);

    const name = normalizeRequiredText(rawGroup.name, `第 ${groupIndex + 1} 个规格组名称`);
    const type = rawGroup.type;
    if (type !== 'single' && type !== 'multiple') {
      throw new AdminError(`第 ${groupIndex + 1} 个规格组类型只能是 single 或 multiple`);
    }

    if (rawGroup.required !== undefined && typeof rawGroup.required !== 'boolean') {
      throw new AdminError(`第 ${groupIndex + 1} 个规格组 required 必须是布尔值`);
    }

    if (!Array.isArray(rawGroup.options) || rawGroup.options.length === 0) {
      throw new AdminError(`第 ${groupIndex + 1} 个规格组至少需要一个选项`);
    }

    const optionIds = new Set<string>();
    const options = rawGroup.options.map((rawOption, optionIndex) => {
      if (!isRecord(rawOption)) {
        throw new AdminError(`第 ${groupIndex + 1} 个规格组的第 ${optionIndex + 1} 个选项格式不正确`);
      }

      const optionId = normalizeOptionId(rawOption.id, `第 ${groupIndex + 1} 个规格组的第 ${optionIndex + 1} 个选项 ID`);
      if (optionIds.has(optionId)) {
        throw new AdminError(`第 ${groupIndex + 1} 个规格组的选项 ID「${optionId}」重复`);
      }
      optionIds.add(optionId);

      const optionName = normalizeRequiredText(rawOption.name, `第 ${groupIndex + 1} 个规格组的第 ${optionIndex + 1} 个选项名称`);
      const priceDelta = Number(rawOption.priceDelta);
      if (!Number.isFinite(priceDelta)) {
        throw new AdminError(`第 ${groupIndex + 1} 个规格组的第 ${optionIndex + 1} 个选项价格必须是数字`);
      }

      return {
        id: optionId,
        name: optionName,
        priceDelta: Number(priceDelta.toFixed(2)),
      };
    });

    return {
      id,
      name,
      type,
      ...(typeof rawGroup.required === 'boolean' ? { required: rawGroup.required } : {}),
      options,
    };
  });
}

function normalizeOptionId(value: unknown, label: string) {
  const id = normalizeRequiredText(value, label);
  if (!/^[a-z0-9_-]{1,64}$/i.test(id)) {
    throw new AdminError(`${label} 只能包含字母、数字、下划线或横线，最多 64 位`);
  }
  return id;
}

function normalizeRequiredText(value: unknown, label: string) {
  if (typeof value !== 'string') throw new AdminError(`${label} 必须是文本`);
  const text = value.trim();
  if (!text) throw new AdminError(`${label} 必填`);
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
