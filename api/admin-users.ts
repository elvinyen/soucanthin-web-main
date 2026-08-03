import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';

type UserRow = {
  id: string;
  phone: string;
  display_phone: string;
  name?: string | null;
  email?: string | null;
  birthday?: string | null;
  source?: string | null;
  created_at: string;
  last_login_at?: string | null;
};

type WalletRow = { user_id: string; balance: number | string; currency?: string; updated_at?: string | null };
type FinancialSummaryRow = { user_id: string; wallet_balance: number | string; order_count: number | string; total_spent: number | string };
type OrderRow = { id: string; user_id?: string | null; order_no: string; payable_total?: number | string | null; total: number | string; status: string; payment_status: string; created_at: string };
type TransactionRow = {
  id: string;
  type: string;
  method: string;
  amount: number | string;
  status: string;
  note?: string | null;
  recharge_channel?: string | null;
  reference_no?: string | null;
  balance_before?: number | string | null;
  balance_after?: number | string | null;
  created_at: string;
  completed_at?: string | null;
  admin_users?: { display_name?: string | null; username?: string | null } | null;
};

const USER_SELECT = 'id,phone,display_phone,name,email,birthday,source,created_at,last_login_at';
const ORDER_SELECT = 'id,user_id,order_no,payable_total,total,status,payment_status,created_at';
const TRANSACTION_SELECT = 'id,type,method,amount,status,note,recharge_channel,reference_no,balance_before,balance_after,created_at,completed_at,admin_users(display_name,username)';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    const method = req.method || 'GET';
    if (method === 'GET') return await getUsers(req, res);
    if (method === 'POST') return await rechargeWallet(req, res, admin);
    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getUsers(req: ApiRequest, res: ApiResponse) {
  const query = parseQuery(req.url);
  const userId = String(query.get('id') || '').trim();
  if (userId) return await getUserDetail(res, userId);

  const search = String(query.get('search') || '').trim();
  const page = Math.max(1, Number.parseInt(String(query.get('page') || '1'), 10) || 1);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const filters = [`select=${USER_SELECT}`, 'order=created_at.desc', `offset=${offset}`, `limit=${pageSize + 1}`];
  const searchOr = buildSearchOr(search);
  if (searchOr) filters.push(`or=${encodeURIComponent(searchOr)}`);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const usersRaw = await supabaseRequest(supabaseUrl, serviceRoleKey, `/users?${filters.join('&')}`, { method: 'GET' });
  const allUsers = Array.isArray(usersRaw) ? usersRaw as UserRow[] : [];
  const hasMore = allUsers.length > pageSize;
  const users = allUsers.slice(0, pageSize);
  const ids = users.map(user => user.id);
  const [walletsRaw, summariesRaw] = ids.length ? await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/wallets?user_id=in.(${ids.join(',')})&select=user_id,balance,currency,updated_at`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/admin_user_financial_summaries', {
      method: 'POST',
      body: JSON.stringify({ user_ids_input: ids }),
    }),
  ]) : [[], []];
  const wallets = Array.isArray(walletsRaw) ? walletsRaw as WalletRow[] : [];
  const summaries = Array.isArray(summariesRaw) ? summariesRaw as FinancialSummaryRow[] : [];
  const walletMap = new Map(wallets.map(wallet => [wallet.user_id, wallet]));
  const summaryMap = new Map(summaries.map(summary => [summary.user_id, {
    orderCount: Number(summary.order_count || 0),
    totalSpent: Number(summary.total_spent || 0),
  }]));

  return res.status(200).json({
    success: true,
    page,
    hasMore,
    users: users.map(user => mapUser(user, walletMap.get(user.id), summaryMap.get(user.id))),
  });
}

async function getUserDetail(res: ApiResponse, userId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const encodedId = encodeURIComponent(userId);
  const [usersRaw, walletsRaw, summariesRaw, transactionsRaw, ordersRaw, couponsRaw, addressesRaw] = await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/users?id=eq.${encodedId}&select=${USER_SELECT}`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/wallets?user_id=eq.${encodedId}&select=user_id,balance,currency,updated_at`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/admin_user_financial_summaries', {
      method: 'POST',
      body: JSON.stringify({ user_ids_input: [userId] }),
    }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/wallet_transactions?user_id=eq.${encodedId}&select=${TRANSACTION_SELECT}&order=created_at.desc&limit=100`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?user_id=eq.${encodedId}&select=${ORDER_SELECT}&order=created_at.desc&limit=100`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/user_coupons?user_id=eq.${encodedId}&select=id,status,source,expires_at,issued_at,used_at,coupons(code,title)&order=issued_at.desc&limit=100`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/user_addresses?user_id=eq.${encodedId}&select=id,label,recipient_name,phone,address,is_default,created_at&order=is_default.desc,created_at.desc`, { method: 'GET' }),
  ]);
  const user = Array.isArray(usersRaw) ? usersRaw[0] as UserRow | undefined : undefined;
  if (!user) throw new AdminError('用户不存在', 404);
  const wallet = Array.isArray(walletsRaw) ? walletsRaw[0] as WalletRow | undefined : undefined;
  const financialSummary = Array.isArray(summariesRaw) ? summariesRaw[0] as FinancialSummaryRow | undefined : undefined;
  const orders = Array.isArray(ordersRaw) ? ordersRaw as OrderRow[] : [];

  return res.status(200).json({
    success: true,
    user: mapUser(user, wallet, {
      orderCount: Number(financialSummary?.order_count || 0),
      totalSpent: Number(financialSummary?.total_spent || 0),
    }),
    transactions: (Array.isArray(transactionsRaw) ? transactionsRaw as TransactionRow[] : []).map(mapTransaction),
    orders: orders.map(order => ({ ...order, payable_total: Number(order.payable_total ?? order.total ?? 0), total: Number(order.total || 0) })),
    coupons: Array.isArray(couponsRaw) ? couponsRaw : [],
    addresses: Array.isArray(addressesRaw) ? addressesRaw : [],
  });
}

async function rechargeWallet(
  req: ApiRequest,
  res: ApiResponse,
  admin: Awaited<ReturnType<typeof requireAdminRole>>,
) {
  if (admin.role !== 'admin') throw new AdminError('只有管理员可以直接充值', 403);
  const input = parseAdminBody<Record<string, unknown>>(req.body);
  if (String(input.action || '') !== 'manual_recharge') throw new AdminError('不支持的操作');
  const userId = String(input.userId || '').trim();
  const amount = money(Number(input.amount));
  const channel = String(input.channel || '').trim();
  const reason = String(input.reason || '').trim();
  const referenceNo = String(input.referenceNo || '').trim();
  const requestId = String(input.requestId || '').trim();
  if (!userId) throw new AdminError('请选择充值用户');
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 100000) throw new AdminError('充值金额需介于 RM 0.01 至 RM 100000');
  if (!['cash', 'tng', 'bank', 'promotion', 'compensation', 'other'].includes(channel)) throw new AdminError('请选择充值来源');
  if (reason.length < 2 || reason.length > 300) throw new AdminError('请填写 2-300 字的充值原因');
  if (referenceNo.length > 100) throw new AdminError('参考编号不能超过 100 个字符');
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new AdminError('充值请求编号不正确');

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/admin_manual_wallet_recharge', {
    method: 'POST',
    body: JSON.stringify({
      user_id_input: userId,
      amount_input: amount,
      admin_id_input: admin.id,
      channel_input: channel,
      reason_input: reason,
      reference_no_input: referenceNo || null,
      idempotency_key_input: requestId,
    }),
  }) as Record<string, unknown>;

  return res.status(201).json({
    success: true,
    transactionId: String(result?.transactionId || ''),
    balanceBefore: Number(result?.balanceBefore || 0),
    balanceAfter: Number(result?.balanceAfter || 0),
  });
}

function buildSearchOr(search: string) {
  const safe = search.trim().replace(/[(),]/g, '').slice(0, 80);
  if (!safe) return '';
  const digits = safe.replace(/\D/g, '');
  const terms = Array.from(new Set([safe, digits].filter(Boolean)));
  return `(${terms.flatMap(term => [`name.ilike.*${term}*`, `phone.ilike.*${term}*`, `display_phone.ilike.*${term}*`, `email.ilike.*${term}*`]).join(',')})`;
}

function mapUser(user: UserRow, wallet?: WalletRow, summary?: { orderCount: number; totalSpent: number }) {
  return {
    id: user.id,
    phone: user.phone,
    displayPhone: user.display_phone,
    name: user.name || '',
    email: user.email || null,
    birthday: user.birthday || null,
    source: user.source || 'otp',
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at || null,
    walletBalance: Number(wallet?.balance || 0),
    walletCurrency: wallet?.currency || 'MYR',
    walletUpdatedAt: wallet?.updated_at || null,
    orderCount: summary?.orderCount || 0,
    totalSpent: summary?.totalSpent || 0,
  };
}

function mapTransaction(row: TransactionRow) {
  return {
    id: row.id,
    type: row.type,
    method: row.method,
    amount: Number(row.amount || 0),
    status: row.status,
    note: row.note || '',
    rechargeChannel: row.recharge_channel || null,
    referenceNo: row.reference_no || null,
    balanceBefore: row.balance_before == null ? null : Number(row.balance_before),
    balanceAfter: row.balance_after == null ? null : Number(row.balance_after),
    operatorName: row.admin_users?.display_name || row.admin_users?.username || null,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
