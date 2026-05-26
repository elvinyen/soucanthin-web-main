import type { MenuItem, MenuOptionGroup } from '../data/menu';
import type { MenuTranslation, MenuTranslations } from '../data/menuTranslations';
import type { LanguageCode } from '../types/i18n';
import { ApiRequest, ApiResponse, getSupabaseConfig, supabaseRequest } from './_order-utils';

type MenuItemRow = {
  id: number;
  name: string;
  en_name: string;
  description: string;
  detail?: string | null;
  price: number;
  category: string;
  image_url: string;
  tags?: string[] | null;
  recommended?: boolean | null;
  sold_out?: boolean | null;
  option_groups?: MenuOptionGroup[] | null;
  translations?: MenuTranslations | null;
};

const SUPPORTED_LANGUAGES: LanguageCode[] = ['zh', 'en', 'th', 'vi'];
const DEFAULT_LANGUAGE: LanguageCode = 'en';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const lang = normalizeLanguage(readLangFromUrl(req.url));
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_items?active=eq.true&select=id,name,en_name,description,detail,price,category,image_url,tags,recommended,sold_out,option_groups,translations&order=sort_order.asc,id.asc',
      { method: 'GET' },
    );

    return res.status(200).json({
      success: true,
      items: (Array.isArray(rows) ? rows : []).map(row => mapMenuItem(row, lang)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Menu is unavailable',
    });
  }
}

function mapMenuItem(row: MenuItemRow, lang: LanguageCode): MenuItem {
  const translation = getTranslation(row.translations, lang);
  return {
    id: Number(row.id),
    name: translation?.name || row.name,
    enName: translation?.enName ?? row.en_name,
    description: translation?.description || row.description,
    detail: translation?.detail || row.detail || row.description,
    price: Number(row.price || 0),
    category: translation?.category || row.category,
    image: row.image_url,
    tags: translation?.tags || (Array.isArray(row.tags) ? row.tags : []),
    optionGroups: mergeOptionGroups(
      Array.isArray(row.option_groups) ? row.option_groups : [],
      translation?.optionGroups,
    ),
    recommended: Boolean(row.recommended),
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

function getTranslation(translations: MenuTranslations | null | undefined, lang: LanguageCode): MenuTranslation | undefined {
  return translations?.[lang] || translations?.zh;
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
