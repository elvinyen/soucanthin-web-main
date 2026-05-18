import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';
import { parseJsonBody } from './_auth-utils';

type ReviewAction = 'approve' | 'reject';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const input = req.method === 'GET' ? parseQuery(req.url || '') : parseJsonBody<Record<string, string>>(req.body);
    const action = String(input.action || '') as ReviewAction;
    const transactionId = String(input.id || input.transactionId || '').trim();
    const reviewToken = String(input.token || '').trim();
    const adminToken = String(input.admin || input.adminToken || '').trim();

    if (!['approve', 'reject'].includes(action)) throw new Error('Invalid review action');
    if (!transactionId || !reviewToken) throw new Error('Missing review token');
    if (!process.env.ADMIN_REVIEW_TOKEN || adminToken !== process.env.ADMIN_REVIEW_TOKEN) {
      throw new Error('Invalid admin token');
    }

    if (action === 'approve') {
      await approveRecharge(transactionId, reviewToken);
    } else {
      await rejectRecharge(transactionId, reviewToken);
    }

    const message = action === 'approve' ? '充值已通过并入账' : '充值已拒绝';
    if (req.method === 'GET') {
      res.setHeader?.('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).end(renderResult(message));
    }

    return res.status(200).json({ success: true, status: action === 'approve' ? 'succeeded' : 'rejected' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '审核失败';
    if (req.method === 'GET') {
      res.setHeader?.('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).end(renderResult(message));
    }
    return res.status(400).json({ success: false, error: message });
  }
}

async function approveRecharge(transactionId: string, reviewToken: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/approve_wallet_recharge', {
    method: 'POST',
    body: JSON.stringify({
      transaction_id_input: transactionId,
      review_token_input: reviewToken,
    }),
  });
}

async function rejectRecharge(transactionId: string, reviewToken: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/wallet_transactions?id=eq.${encodeURIComponent(transactionId)}&review_token=eq.${encodeURIComponent(reviewToken)}&status=eq.pending&select=id`,
    { method: 'GET' },
  );
  if (!Array.isArray(existing) || !existing[0]?.id) {
    throw new Error('待审核充值不存在或已处理');
  }

  await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/wallet_transactions?id=eq.${encodeURIComponent(transactionId)}&review_token=eq.${encodeURIComponent(reviewToken)}&status=eq.pending`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'rejected',
        completed_at: new Date().toISOString(),
        note: 'TNG wallet top up rejected',
      }),
    },
  );
}

function parseQuery(url: string) {
  const queryText = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  return Object.fromEntries(new URLSearchParams(queryText));
}

function renderResult(message: string) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>钱包充值审核</title><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f4;color:#292524;display:grid;min-height:100vh;place-items:center;margin:0"><main style="background:white;border:1px solid #e7e5e4;border-radius:20px;padding:28px;max-width:360px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.08)"><h1 style="font-size:20px;margin:0 0 12px">钱包充值审核</h1><p style="margin:0;color:#78716c;line-height:1.6">${escapeHtml(message)}</p></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}
