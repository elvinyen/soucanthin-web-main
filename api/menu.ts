import type { MenuItem, MenuOptionGroup } from '../data/menu';
import type { MenuTranslation } from '../data/menuTranslations';
import type { LanguageCode } from '../types/i18n';
import { ApiRequest, ApiResponse, getSupabaseConfig, supabaseRequest } from './_order-utils';

type MenuItemRow = {
  id: number;
  item_code?: string | null;
  name: string;
  description: string;
  detail?: string | null;
  price: number;
  category_id?: number | null;
  image_url: string;
  tags?: string[] | null;
  recommended?: boolean | null;
  sold_out?: boolean | null;
  option_groups?: MenuOptionGroup[] | null;
};

type MenuTranslationRow = {
  item_id: number;
  lang: LanguageCode;
  name: string;
  description: string;
  detail: string;
  category_label?: string | null;
  tags?: string[] | null;
  option_groups?: MenuTranslation['optionGroups'] | null;
};

const SUPPORTED_LANGUAGES: LanguageCode[] = ['zh', 'en', 'th', 'vi'];
const DEFAULT_LANGUAGE: LanguageCode = 'en';
const DISPLAY_TAGS = ['热卖', '新品', '招牌'];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const lang = normalizeLanguage(readLangFromUrl(req.url));
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const [rows, categories, translations] = await Promise.all([
      supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        '/menu_items?active=eq.true&select=id,item_code,name,description,detail,price,category_id,image_url,tags,recommended,sold_out,option_groups&order=sort_order.asc,id.asc',
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
        Number((category as { id: number }).id),
        String((category as { label: string }).label),
      ]),
    );
    const translationsByItem = groupTranslations(Array.isArray(translations) ? translations as MenuTranslationRow[] : []);

    return res.status(200).json({
      success: true,
      items: (Array.isArray(rows) ? rows : []).map(row => mapMenuItem(row, lang, categoryLabels, translationsByItem)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Menu is unavailable',
    });
  }
}

function mapMenuItem(
  row: MenuItemRow,
  lang: LanguageCode,
  categoryLabels: Map<number, string>,
  translationsByItem: Map<number, Map<LanguageCode, MenuTranslation>>,
): MenuItem {
  const translation = getTranslation(translationsByItem.get(Number(row.id)), lang);
  const category = categoryLabels.get(Number(row.category_id)) || '';
  const sourceTags = Array.isArray(row.tags) ? row.tags : [];
  const translatedTags = translation?.tags;
  const displayLabel = Boolean(row.recommended) ? '推荐' : sourceTags.find(tag => DISPLAY_TAGS.includes(tag));
  return {
    id: Number(row.id),
    code: row.item_code || undefined,
    name: translation?.name || row.name,
    description: translation?.description || row.description,
    detail: translation?.detail || row.detail || row.description,
    price: Number(row.price || 0),
    category: translation?.category || category,
    image: row.image_url,
    tags: (translatedTags || sourceTags).filter(tag => !DISPLAY_TAGS.includes(tag)),
    optionGroups: mergeOptionGroups(
      Array.isArray(row.option_groups) ? row.option_groups : [],
      translation?.optionGroups,
    ),
    recommended: Boolean(row.recommended),
    displayLabel,
    soldOut: Boolean(row.sold_out),
  };
}

function readLangFromUrl(url?: string) {
  if (!url) return undefined;
  return new URL(url, 'http://localhost').searchParams.get('lang') || undefined;
}

function normalizeLanguage(value?: string | null): LanguageCode {
  const normalized = value?.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(normalized as LanguageCode) ? normalized as LanguageCode : DEFAULT_LANGUAGE;
}

function groupTranslations(rows: MenuTranslationRow[]) {
  const grouped = new Map<number, Map<LanguageCode, MenuTranslation>>();
  rows.forEach(row => {
    const itemTranslations = grouped.get(Number(row.item_id)) || new Map<LanguageCode, MenuTranslation>();
    itemTranslations.set(row.lang, {
      name: row.name,
      description: row.description,
      detail: row.detail,
      category: row.category_label || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      optionGroups: Array.isArray(row.option_groups) ? row.option_groups : [],
    });
    grouped.set(Number(row.item_id), itemTranslations);
  });
  return grouped;
}

function getTranslation(translations: Map<LanguageCode, MenuTranslation> | undefined, lang: LanguageCode): MenuTranslation | undefined {
  if (lang === 'zh') return undefined;
  return translations?.get(lang);
}

function mergeOptionGroups(groups: MenuOptionGroup[], translations: MenuTranslation['optionGroups']) {
  if (!translations?.length) return groups;
  return groups.map(group => {
    const translatedGroup = translations.find(item => item.id === group.id);
    if (!translatedGroup) return group;
    return {
      ...group,
      name: translatedGroup.name || group.name,
      options: group.options.map(option => ({
        ...option,
        name: translatedGroup.options?.find(item => item.id === option.id)?.name || option.name,
      })),
    };
  });
}
