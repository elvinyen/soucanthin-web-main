import type { ApiRequest, ApiResponse } from './_order-utils';

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  return res.status(200).json({
    success: true,
    tng: {
      accountName: process.env.TNG_ACCOUNT_NAME || '',
      accountNumber: process.env.TNG_ACCOUNT_NUMBER || '',
    },
  });
}
