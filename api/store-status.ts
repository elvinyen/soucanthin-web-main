import type { ApiRequest, ApiResponse } from './_order-utils';
import { getStoreOperationalStatus, getWebsiteStoreOperationalStatus, getWebsiteStoreOperationalStatuses } from './_store-operations';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const branchId = new URL(req.url || '/api/store-status', 'http://localhost').searchParams.get('branchId');
    if (branchId) {
      const store = await getStoreOperationalStatus(branchId);
      return res.status(200).json({ success: true, store, stores: [store] });
    }
    const stores = await getWebsiteStoreOperationalStatuses();
    const store = stores.find(item => item.open) || stores[0] || await getWebsiteStoreOperationalStatus();
    return res.status(200).json({ success: true, store, stores });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Store status is unavailable' });
  }
}
