import type { ApiRequest, ApiResponse } from './_order-utils';
import { getAuthenticatedUser, getWallet, getWalletTransactions } from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录' });

  const [wallet, transactions] = await Promise.all([
    getWallet(user.id),
    getWalletTransactions(user.id),
  ]);

  return res.status(200).json({ success: true, wallet, transactions });
}
