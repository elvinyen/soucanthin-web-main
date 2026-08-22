import { formatStoreSchedule, isStoreOpen, STORE_CLOSE_MINUTE, STORE_OPEN_MINUTE, WEBSITE_STORE_BRANCH } from '../businessHours';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

export type StoreOperationalStatus = {
  branchId: string;
  branchName: string;
  configured: boolean;
  scheduledOpen: boolean;
  acceptingOrders: boolean;
  open: boolean;
  pauseReason: string | null;
  openingMinute: number;
  closingMinute: number;
  schedule: string;
};

export type StoreBranchOperationRow = {
  id: string;
  name: string;
  active: boolean;
  sort_order?: number | null;
  accepting_orders?: boolean | null;
  pause_reason?: string | null;
  opening_minute?: number | null;
  closing_minute?: number | null;
};

export async function getStoreOperationalStatus(branchId: string = WEBSITE_STORE_BRANCH.id): Promise<StoreOperationalStatus> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?id=eq.${encodeURIComponent(branchId)}&select=id,name,active,accepting_orders,pause_reason,opening_minute,closing_minute&limit=1`,
    { method: 'GET' },
  );
  const branch = Array.isArray(rows) ? rows[0] as StoreBranchOperationRow | undefined : undefined;
  return buildStoreOperationalStatus(branch, branchId);
}

// The customer website does not ask customers to choose a branch. Route it to the
// highest-priority branch that can accept an order right now instead of pinning it
// to the historical Cheras default.
export async function getWebsiteStoreOperationalStatus(): Promise<StoreOperationalStatus> {
  const statuses = await getWebsiteStoreOperationalStatuses();
  return statuses.find(status => status.open) || statuses[0] || buildStoreOperationalStatus(undefined, WEBSITE_STORE_BRANCH.id);
}

export async function getWebsiteStoreOperationalStatuses(): Promise<StoreOperationalStatus[]> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    '/store_branches?active=eq.true&select=id,name,active,sort_order,accepting_orders,pause_reason,opening_minute,closing_minute&order=sort_order.asc,id.asc',
    { method: 'GET' },
  );
  return (Array.isArray(rows) ? rows as StoreBranchOperationRow[] : []).map(branch => buildStoreOperationalStatus(branch, branch.id));
}

export function selectWebsiteStoreStatus(branches: StoreBranchOperationRow[], date = new Date()): StoreOperationalStatus {
  const statuses = branches.map(branch => buildStoreOperationalStatus(branch, branch.id, date));
  return statuses.find(status => status.open) || statuses[0] || buildStoreOperationalStatus(undefined, WEBSITE_STORE_BRANCH.id, date);
}

function buildStoreOperationalStatus(branch: StoreBranchOperationRow | undefined, fallbackBranchId: string, date = new Date()): StoreOperationalStatus {
  const configured = branch?.active === true;
  const openingMinute = normalizeMinute(branch?.opening_minute, STORE_OPEN_MINUTE);
  const closingMinute = normalizeMinute(branch?.closing_minute, STORE_CLOSE_MINUTE);
  const scheduledOpen = isStoreOpen(date, openingMinute, closingMinute);
  const acceptingOrders = branch?.accepting_orders !== false;
  return {
    branchId: branch?.id || fallbackBranchId,
    branchName: branch?.name || WEBSITE_STORE_BRANCH.name,
    configured,
    scheduledOpen,
    acceptingOrders,
    open: configured && scheduledOpen && acceptingOrders,
    pauseReason: branch?.pause_reason || null,
    openingMinute,
    closingMinute,
    schedule: formatStoreSchedule(openingMinute, closingMinute),
  };
}

function normalizeMinute(value: number | null | undefined, fallback: number) {
  const minute = Number(value);
  return Number.isInteger(minute) && minute >= 0 && minute < 1440 ? minute : fallback;
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
