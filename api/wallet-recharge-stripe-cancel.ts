import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';
import { getAuthenticatedUser, parseJsonBody } from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录' });

  try {
    const body = parseJsonBody<{ transactionId?: string }>(req.body);
    const transactionId = String(body.transactionId || '').trim();
    if (!transactionId) throw new Error('缺少充值流水编号');

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const existing = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      `/wallet_transactions?id=eq.${encodeURIComponent(transactionId)}&user_id=eq.${encodeURIComponent(user.id)}&method=eq.stripe&select=id,status`,
      { method: 'GET' },
    );
    const transaction = Array.isArray(existing) ? existing[0] as { id?: string; status?: string } | undefined : undefined;
    if (!transaction?.id) throw new Error('充值流水不存在');

    if (transaction.status === 'pending') {
      await supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        `/wallet_transactions?id=eq.${encodeURIComponent(transactionId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'failed',
            completed_at: new Date().toISOString(),
            note: 'Stripe wallet top up was cancelled before payment',
          }),
        },
      );
    }

    return res.status(200).json({ success: true, status: transaction.status === 'pending' ? 'failed' : transaction.status });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '无法处理 Stripe 充值取消',
    });
  }
}
