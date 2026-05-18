import type { MenuItem, MenuOptionGroup } from '../data/menu';
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
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_items?active=eq.true&select=id,name,en_name,description,detail,price,category,image_url,tags,recommended,sold_out,option_groups&order=sort_order.asc,id.asc',
      { method: 'GET' },
    );

    return res.status(200).json({
      success: true,
      items: (Array.isArray(rows) ? rows : []).map(mapMenuItem),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Menu is unavailable',
    });
  }
}

function mapMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: Number(row.id),
    name: row.name,
    enName: row.en_name,
    description: row.description,
    detail: row.detail || row.description,
    price: Number(row.price || 0),
    category: row.category,
    image: row.image_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    optionGroups: Array.isArray(row.option_groups) ? row.option_groups : [],
    recommended: Boolean(row.recommended),
    soldOut: Boolean(row.sold_out),
  };
}
