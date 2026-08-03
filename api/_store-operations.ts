import { isStoreOpen, WEBSITE_STORE_BRANCH } from '../businessHours';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

export type StoreOperationalStatus = {
  branchId: string;
  branchName: string;
  configured: boolean;
  scheduledOpen: boolean;
  acceptingOrders: boolean;
  open: boolean;
  pauseReason: string | null;
};

type StoreBranchOperationRow = {
  id: string;
  name: string;
  active: boolean;
  accepting_orders?: boolean | null;
  pause_reason?: string | null;
};

export async function getStoreOperationalStatus(branchId: string = WEBSITE_STORE_BRANCH.id): Promise<StoreOperationalStatus> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?id=eq.${encodeURIComponent(branchId)}&select=id,name,active,accepting_orders,pause_reason&limit=1`,
    { method: 'GET' },
  );
  const branch = Array.isArray(rows) ? rows[0] as StoreBranchOperationRow | undefined : undefined;
  const configured = branch?.active === true;
  const scheduledOpen = isStoreOpen();
  const acceptingOrders = branch?.accepting_orders !== false;
  return {
    branchId: branch?.id || branchId,
    branchName: branch?.name || WEBSITE_STORE_BRANCH.name,
    configured,
    scheduledOpen,
    acceptingOrders,
    open: configured && scheduledOpen && acceptingOrders,
    pauseReason: branch?.pause_reason || null,
  };
}

export async function getBranchSoldOutItemIds(branchId: string, itemIds?: number[]) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const itemFilter = itemIds?.length
    ? `&menu_item_id=in.(${itemIds.map(id => encodeURIComponent(String(id))).join(',')})`
    : '';
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/branch_menu_availability?branch_id=eq.${encodeURIComponent(branchId)}&sold_out=eq.true${itemFilter}&select=menu_item_id`,
    { method: 'GET' },
  );
  return new Set((Array.isArray(rows) ? rows : []).map(row => Number((row as { menu_item_id: number }).menu_item_id)));
}
