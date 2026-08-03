import { AdminError, jsonError, parseAdminBody, requireAdminRole } from './_admin-utils';
import { getDeliverySettings, validateDeliverySettings, type DeliverySettings } from './_delivery-policy';
import { type ApiRequest, type ApiResponse, getSupabaseConfig, supabaseRequest } from './_order-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';
    if (method === 'GET') return res.status(200).json({ success: true, settings: await getDeliverySettings(), lalamoveConfigured: hasLalamoveCredentials() });
    if (method !== 'PATCH' && method !== 'PUT') {
      res.setHeader?.('Allow', 'GET, PATCH, PUT');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    const input = parseAdminBody<DeliverySettings>(req.body);
    const currentSettings = admin.role === 'admin' ? null : await getDeliverySettings();
    if (currentSettings && Boolean(input.lalamoveEnabled) !== currentSettings.lalamoveEnabled) {
      throw new AdminError('只有管理员可以切换 Lalamove 实时报价', 403);
    }
    const settings = validateDeliverySettings({
      maxAutoDistanceKm: Number(input.maxAutoDistanceKm),
      lalamoveEnabled: Boolean(input.lalamoveEnabled),
      lalamoveMarkupPercent: Number(input.lalamoveMarkupPercent),
      quoteLockMinutes: Number(input.quoteLockMinutes),
      requestExpiryMinutes: Number(input.requestExpiryMinutes),
      approvalExpiryMinutes: Number(input.approvalExpiryMinutes),
      fallbackFeeTiers: input.fallbackFeeTiers,
    });
    if (settings.lalamoveEnabled && !hasLalamoveCredentials()) throw new AdminError('请先配置LALAMOVE_API_KEY和LALAMOVE_API_SECRET');
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    await supabaseRequest(supabaseUrl, serviceRoleKey, '/delivery_settings?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: 'default',
        max_auto_distance_km: settings.maxAutoDistanceKm,
        lalamove_enabled: settings.lalamoveEnabled,
        lalamove_markup_percent: settings.lalamoveMarkupPercent,
        quote_lock_minutes: settings.quoteLockMinutes,
        request_expiry_minutes: settings.requestExpiryMinutes,
        approval_expiry_minutes: settings.approvalExpiryMinutes,
        fallback_fee_tiers: settings.fallbackFeeTiers,
        updated_by: admin.id,
      }),
    });
    return res.status(200).json({ success: true, settings, lalamoveConfigured: hasLalamoveCredentials() });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

function hasLalamoveCredentials() {
  return Boolean(process.env.LALAMOVE_API_KEY?.trim() && process.env.LALAMOVE_API_SECRET?.trim());
}
