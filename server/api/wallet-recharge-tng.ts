import { randomBytes } from 'node:crypto';
import type { ReceiptImage } from '../../types/order';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, roundMoney, sendTelegramNotification, supabaseRequest, uploadReceipt, validateReceiptImage } from './_order-utils';
import { getAuthenticatedUser, parseJsonBody } from './_auth-utils';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录' });

  try {
    const body = parseJsonBody<{ amount?: number; receiptImage?: ReceiptImage }>(req.body);
    const amount = validateRechargeAmount(body.amount);
    const receiptError = validateReceiptImage(body.receiptImage);
    if (receiptError) throw new Error(receiptError);

    const reviewToken = randomBytes(24).toString('base64url');
    const receiptUrl = await uploadReceipt(`WALLET-${Date.now()}`, body.receiptImage!);
    const transaction = await createPendingTngTransaction({
      userId: user.id,
      amount,
      receiptUrl,
      reviewToken,
    });

    const notificationStatus = await sendTelegramNotification(buildTngReviewMessage({
      transactionId: transaction.id,
      phone: user.display_phone,
      amount,
      receiptUrl,
      reviewToken,
    }));

    return res.status(200).json({
      success: true,
      transactionId: transaction.id,
      status: 'pending',
      notificationStatus,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '无法提交 TNG 充值',
    });
  }
}

function validateRechargeAmount(value: unknown) {
  const amount = roundMoney(Number(value));
  if (!Number.isFinite(amount) || amount < 5 || amount > 1000) {
    throw new Error('充值金额需介于 RM 5 至 RM 1000');
  }
  return amount;
}

async function createPendingTngTransaction(params: {
  userId: string;
  amount: number;
  receiptUrl: string;
  reviewToken: string;
}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/wallet_transactions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: params.userId,
      type: 'recharge',
      method: 'tng',
      amount: params.amount,
      status: 'pending',
      receipt_url: params.receiptUrl,
      review_token: params.reviewToken,
      note: 'TNG wallet top up pending review',
    }),
  });
  const record = Array.isArray(result) ? result[0] : null;
  if (!record?.id) throw new Error('充值记录创建失败');
  return record as { id: string };
}

function buildTngReviewMessage(params: {
  transactionId: string;
  phone: string;
  amount: number;
  receiptUrl: string;
  reviewToken: string;
}) {
  const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const adminToken = process.env.ADMIN_REVIEW_TOKEN || '';
  const approveUrl = `${siteUrl}/api/admin/wallet-recharge-review?action=approve&id=${encodeURIComponent(params.transactionId)}&token=${encodeURIComponent(params.reviewToken)}&admin=${encodeURIComponent(adminToken)}`;
  const rejectUrl = `${siteUrl}/api/admin/wallet-recharge-review?action=reject&id=${encodeURIComponent(params.transactionId)}&token=${encodeURIComponent(params.reviewToken)}&admin=${encodeURIComponent(adminToken)}`;

  return [
    '[钱包充值审核] TNG 待审核',
    '',
    `流水ID: ${params.transactionId}`,
    `用户手机: ${params.phone}`,
    `金额: RM ${params.amount.toFixed(2)}`,
    `截图: ${params.receiptUrl}`,
    '',
    `通过: ${approveUrl}`,
    `拒绝: ${rejectUrl}`,
  ].join('\n');
}
