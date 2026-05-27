import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type PaymentSettingsRow = {
  tng_account_name?: string | null;
  tng_account_number?: string | null;
  tng_qr_image_url?: string | null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const fallback = {
    accountName: process.env.TNG_ACCOUNT_NAME || '',
    accountNumber: process.env.TNG_ACCOUNT_NUMBER || '',
    qrImageUrl: process.env.TNG_QR_IMAGE_URL || '',
  };

  let settings: PaymentSettingsRow | undefined;
  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const rows = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      '/payment_settings?id=eq.default&select=tng_account_name,tng_account_number,tng_qr_image_url&limit=1',
      { method: 'GET' },
    ) as PaymentSettingsRow[];
    settings = rows?.[0];
  } catch (error) {
    console.warn('Unable to load payment settings from Supabase, using env fallback.', error);
  }

  return res.status(200).json({
    success: true,
    tng: {
      accountName: settings?.tng_account_name || fallback.accountName,
      accountNumber: settings?.tng_account_number || fallback.accountNumber,
      qrImageUrl: settings?.tng_qr_image_url || fallback.qrImageUrl,
    },
  });
}
