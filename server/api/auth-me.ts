import type { ApiRequest, ApiResponse } from './_order-utils';
import {
  getAuthenticatedUser,
  getUserAddresses,
  getUserCoupons,
  getUserOrders,
  getWallet,
  mapUser,
} from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(200).json({ success: true, authenticated: false });
    }

    const [wallet, orders, addresses, coupons] = await Promise.all([
      getWallet(user.id),
      getUserOrders(user.id),
      getUserAddresses(user.id),
      getUserCoupons(user.id),
    ]);

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: mapUser(user),
      wallet,
      orders,
      addresses,
      coupons,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      authenticated: false,
      error: error instanceof Error ? error.message : '无法读取登录状态',
    });
  }
}
