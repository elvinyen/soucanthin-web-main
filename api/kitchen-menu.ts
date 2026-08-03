import { WEBSITE_STORE_BRANCH } from '../businessHours';
import { AdminError, enforceAdminBranch, hasAllBranchAccess, jsonError, parseAdminBody, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';
import { getBranchSoldOutItemIds, getStoreOperationalStatus } from './_store-operations';

type KitchenMenuInput = {
  action?: 'set-item-availability' | 'set-store-accepting';
  branchId?: string;
  itemId?: number | string;
  soldOut?: boolean;
  acceptingOrders?: boolean;
  reason?: string | null;
};

type KitchenMenuItemRow = {
  id: number;
  item_code?: string | null;
  name: string;
  image_url?: string | null;
  sold_out?: boolean | null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'kitchen']);
    const input = req.method === 'GET' ? {} : parseAdminBody<KitchenMenuInput>(req.body);
    const requestedBranchId = req.method === 'GET'
      ? new URL(req.url || '/api/kitchen/menu', 'http://localhost').searchParams.get('branchId') || undefined
      : input.branchId;
    const branchId = resolveBranchId(admin, requestedBranchId);

    if ((req.method || 'GET') === 'GET') return await getKitchenMenu(res, branchId);
    if (req.method === 'PATCH' || req.method === 'POST') {
      if (input.action === 'set-item-availability') return await setItemAvailability(res, admin.id, branchId, input);
      if (input.action === 'set-store-accepting') return await setStoreAccepting(res, admin.id, branchId, input);
      throw new AdminError('Unknown kitchen menu action');
    }

    res.setHeader?.('Allow', 'GET, PATCH, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

function resolveBranchId(admin: Awaited<ReturnType<typeof requireAdminRole>>, requested?: string) {
  if (hasAllBranchAccess(admin)) return String(requested || WEBSITE_STORE_BRANCH.id).trim();
  return enforceAdminBranch(admin, requested) || '';
}

async function getKitchenMenu(res: ApiResponse, branchId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const [rows, translations, branchSoldOutIds, store] = await Promise.all([
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_items?active=eq.true&select=id,item_code,name,image_url,sold_out&order=sort_order.asc,id.asc',
      { method: 'GET' },
    ),
    supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/menu_item_translations?lang=eq.en&select=item_id,name',
      { method: 'GET' },
    ),
    getBranchSoldOutItemIds(branchId),
    getStoreOperationalStatus(branchId),
  ]);
  const englishNames = new Map(
    (Array.isArray(translations) ? translations : []).map(row => [
      Number((row as { item_id: number }).item_id),
      String((row as { name: string }).name || ''),
    ]),
  );
  const items = (Array.isArray(rows) ? rows as KitchenMenuItemRow[] : []).map(item => ({
    id: Number(item.id),
    code: item.item_code || null,
    name: englishNames.get(Number(item.id)) || item.name,
    image: item.image_url || null,
    soldOut: Boolean(item.sold_out) || branchSoldOutIds.has(Number(item.id)),
    globallySoldOut: Boolean(item.sold_out),
  }));
  return res.status(200).json({ success: true, branchId, store, items, syncedAt: new Date().toISOString() });
}

async function setItemAvailability(res: ApiResponse, adminId: string, branchId: string, input: KitchenMenuInput) {
  const itemId = Number(input.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0 || typeof input.soldOut !== 'boolean') throw new AdminError('Invalid item availability');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const items = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/menu_items?id=eq.${encodeURIComponent(String(itemId))}&active=eq.true&select=id,sold_out&limit=1`,
    { method: 'GET' },
  );
  const item = Array.isArray(items) ? items[0] as { id: number; sold_out?: boolean } | undefined : undefined;
  if (!item) throw new AdminError('Menu item not found', 404);
  if (item.sold_out && input.soldOut === false) throw new AdminError('This item was disabled by a manager', 409);

  const updated = await supabaseRequest(supabaseUrl, serviceRoleKey, '/branch_menu_availability?on_conflict=branch_id,menu_item_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      branch_id: branchId,
      menu_item_id: itemId,
      sold_out: input.soldOut,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!Array.isArray(updated) || !updated[0]) throw new AdminError('Availability update failed', 500);
  return res.status(200).json({ success: true, itemId, soldOut: input.soldOut });
}

async function setStoreAccepting(res: ApiResponse, adminId: string, branchId: string, input: KitchenMenuInput) {
  if (typeof input.acceptingOrders !== 'boolean') throw new AdminError('Invalid store status');
  const reason = input.acceptingOrders ? null : normalizePauseReason(input.reason);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const updated = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/store_branches?id=eq.${encodeURIComponent(branchId)}&active=eq.true`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        accepting_orders: input.acceptingOrders,
        pause_reason: reason,
        paused_at: input.acceptingOrders ? null : new Date().toISOString(),
        paused_by: input.acceptingOrders ? null : adminId,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!Array.isArray(updated) || !updated[0]) throw new AdminError('Store not found or disabled', 404);
  return res.status(200).json({ success: true, store: await getStoreOperationalStatus(branchId) });
}

function normalizePauseReason(value: unknown) {
  const reason = String(value || 'Kitchen busy').trim();
  const allowed = ['Food finished', 'Kitchen busy', 'Emergency', 'Closing early'];
  return allowed.includes(reason) ? reason : 'Kitchen busy';
}
