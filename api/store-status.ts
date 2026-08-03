import { WEBSITE_STORE_BRANCH } from '../businessHours';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getStoreOperationalStatus } from './_store-operations';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const branchId = new URL(req.url || '/api/store-status', 'http://localhost').searchParams.get('branchId') || WEBSITE_STORE_BRANCH.id;
    const store = await getStoreOperationalStatus(branchId);
    return res.status(200).json({ success: true, store });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Store status is unavailable' });
  }
}
