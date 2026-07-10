import { randomUUID } from 'node:crypto';
import { AdminError, jsonError, parseAdminBody, parseQuery, requireAdminRole } from './_admin-utils';
import type { AdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseAuthHeaders, supabaseRequest } from './_order-utils';

type FinanceType = 'income' | 'expense';
type FinanceStatus = 'submitted' | 'approved' | 'voided';

type FinanceInput = {
  action?: 'create' | 'void' | 'approve';
  id?: string;
  branchId?: string;
  type?: FinanceType;
  categoryId?: string;
  amount?: number | string;
  paymentMethod?: string;
  occurredAt?: string;
  vendorName?: string;
  note?: string;
  receipt?: { dataBase64?: string; contentType?: string; fileName?: string } | null;
};

type FinanceRow = {
  id: string;
  branch_id: string;
  transaction_type: FinanceType;
  category_id: string;
  amount: number | string;
  payment_method: string;
  occurred_at: string;
  vendor_name?: string | null;
  note?: string | null;
  receipt_path?: string | null;
  status: FinanceStatus;
  created_by: string;
  created_by_name: string;
  approved_by?: string | null;
  approved_at?: string | null;
  voided_by?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  created_at: string;
};

type CategoryRow = { id: string; name: string; type: FinanceType; icon: string; color: string; sort_order: number; active: boolean };
type BranchRow = { id: string; name: string; active: boolean };
type OrderRow = {
  id: string;
  order_no: string;
  assigned_branch_id?: string | null;
  assigned_branch_name?: string | null;
  payment_method: string;
  payment_status: string;
  status: string;
  payable_total?: number | string | null;
  total: number | string;
  created_at: string;
};

const FINANCE_ROLES: AdminRole[] = ['admin', 'owner', 'manager', 'staff'];
const MANAGER_ROLES: AdminRole[] = ['admin', 'owner', 'manager'];
const PAYMENT_METHODS = ['cash', 'tng', 'bank', 'card', 'stripe', 'wallet'] as const;
const TRANSACTION_SELECT = 'id,branch_id,transaction_type,category_id,amount,payment_method,occurred_at,vendor_name,note,receipt_path,status,created_by,created_by_name,approved_by,approved_at,voided_by,voided_at,void_reason,created_at';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, FINANCE_ROLES);
    const method = req.method || 'GET';
    if (method === 'GET') return await getFinance(req, res, admin);
    if (method === 'POST') return await createTransaction(req, res, admin);
    if (method === 'PATCH' || method === 'PUT') return await updateTransaction(req, res, admin);
    res.setHeader?.('Allow', 'GET, POST, PATCH, PUT');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function getFinance(req: ApiRequest, res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  const query = parseQuery(req.url);
  const range = normalizeRange(query.get('from'), query.get('to'));
  const requestedBranch = String(query.get('branchId') || '').trim();
  const branchId = enforceBranchAccess(admin, requestedBranch);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const [categoriesRaw, branchesRaw, transactionsRaw, ordersRaw] = await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, '/finance_categories?active=eq.true&select=id,name,type,icon,color,sort_order,active&order=sort_order.asc,name.asc', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/store_branches?active=eq.true&select=id,name,active&order=sort_order.asc,id.asc', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/finance_transactions?${[
      `occurred_at=gte.${encodeURIComponent(range.from)}`,
      `occurred_at=lt.${encodeURIComponent(range.to)}`,
      branchId ? `branch_id=eq.${encodeURIComponent(branchId)}` : '',
      `select=${TRANSACTION_SELECT}`,
      'order=occurred_at.desc',
      'limit=500',
    ].filter(Boolean).join('&')}`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?${[
      `created_at=gte.${encodeURIComponent(range.from)}`,
      `created_at=lt.${encodeURIComponent(range.to)}`,
      branchId ? `assigned_branch_id=eq.${encodeURIComponent(branchId)}` : '',
      'status=neq.cancelled',
      'select=id,order_no,assigned_branch_id,assigned_branch_name,payment_method,payment_status,status,payable_total,total,created_at',
      'order=created_at.desc',
      'limit=1000',
    ].filter(Boolean).join('&')}`, { method: 'GET' }),
  ]);

  const categories = Array.isArray(categoriesRaw) ? categoriesRaw as CategoryRow[] : [];
  const branches = (Array.isArray(branchesRaw) ? branchesRaw as BranchRow[] : []).filter(branch => canAccessBranch(admin, branch.id));
  const manualRows = Array.isArray(transactionsRaw) ? transactionsRaw as FinanceRow[] : [];
  const orderRows = (Array.isArray(ordersRaw) ? ordersRaw as OrderRow[] : []).filter(isRecognizedOrderIncome);
  const signedUrls = await signReceiptPaths(manualRows.map(row => row.receipt_path).filter(Boolean) as string[]);
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const branchMap = new Map(branches.map(branch => [branch.id, branch.name]));
  const manualTransactions = manualRows.map(row => ({
    id: row.id,
    source: 'manual' as const,
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id) || row.branch_id,
    type: row.transaction_type,
    categoryId: row.category_id,
    categoryName: categoryMap.get(row.category_id)?.name || '其他',
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method,
    occurredAt: row.occurred_at,
    vendorName: row.vendor_name || '',
    note: row.note || '',
    receiptUrl: row.receipt_path ? signedUrls.get(row.receipt_path) || null : null,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
  }));
  const orderTransactions = orderRows.map(order => ({
    id: order.id,
    source: 'order' as const,
    branchId: order.assigned_branch_id || '',
    branchName: order.assigned_branch_name || branchMap.get(order.assigned_branch_id || '') || '未分配门店',
    type: 'income' as const,
    categoryId: 'order-sales',
    categoryName: '订单营业收入',
    amount: Number(order.payable_total ?? order.total ?? 0),
    paymentMethod: order.payment_method,
    occurredAt: order.created_at,
    vendorName: '',
    note: `订单 ${order.order_no}`,
    receiptUrl: null,
    status: 'approved' as const,
    createdBy: '',
    createdByName: '系统订单',
  }));
  const transactions = [...manualTransactions, ...orderTransactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const activeManual = manualTransactions.filter(row => row.status !== 'voided');
  const income = sum(orderTransactions.map(row => row.amount)) + sum(activeManual.filter(row => row.type === 'income').map(row => row.amount));
  const expense = sum(activeManual.filter(row => row.type === 'expense').map(row => row.amount));

  return res.status(200).json({
    success: true,
    categories,
    branches,
    transactions,
    summary: {
      income: roundMoney(income),
      expense: roundMoney(expense),
      balance: roundMoney(income - expense),
      orderCount: orderTransactions.length,
      averageOrder: orderTransactions.length ? roundMoney(sum(orderTransactions.map(row => row.amount)) / orderTransactions.length) : 0,
      pendingCount: manualTransactions.filter(row => row.status === 'submitted').length,
    },
    analytics: buildAnalytics(transactions.filter(row => row.status !== 'voided')),
    range,
  });
}

async function createTransaction(req: ApiRequest, res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  const input = parseAdminBody<FinanceInput>(req.body);
  const branchId = enforceBranchAccess(admin, String(input.branchId || '').trim());
  if (!branchId) throw new AdminError('请选择门店');
  const type = input.type;
  if (type !== 'income' && type !== 'expense') throw new AdminError('收支类型不正确');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new AdminError('请输入有效金额');
  const paymentMethod = String(input.paymentMethod || '').trim();
  if (!PAYMENT_METHODS.includes(paymentMethod as typeof PAYMENT_METHODS[number])) throw new AdminError('付款方式不正确');
  const occurredAt = normalizeDate(input.occurredAt || new Date().toISOString());
  const categoryId = String(input.categoryId || '').trim();
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const categoryRows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/finance_categories?id=eq.${encodeURIComponent(categoryId)}&type=eq.${type}&active=eq.true&select=id&limit=1`, { method: 'GET' });
  if (!Array.isArray(categoryRows) || !categoryRows.length) throw new AdminError('请选择有效分类');

  const receiptPath = input.receipt ? await uploadReceipt(input.receipt, branchId) : null;
  const autoApprove = MANAGER_ROLES.includes(admin.role);
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/finance_transactions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      branch_id: branchId,
      transaction_type: type,
      category_id: categoryId,
      amount: roundMoney(amount),
      payment_method: paymentMethod,
      occurred_at: occurredAt,
      vendor_name: cleanText(input.vendorName, 100) || null,
      note: cleanText(input.note, 500) || null,
      receipt_path: receiptPath,
      status: autoApprove ? 'approved' : 'submitted',
      created_by: admin.id,
      created_by_name: admin.displayName || admin.username,
      approved_by: autoApprove ? admin.id : null,
      approved_at: autoApprove ? new Date().toISOString() : null,
    }),
  });
  const row = Array.isArray(created) ? created[0] : created;
  return res.status(201).json({ success: true, transaction: row });
}

async function updateTransaction(req: ApiRequest, res: ApiResponse, admin: Awaited<ReturnType<typeof requireAdminRole>>) {
  if (!MANAGER_ROLES.includes(admin.role)) throw new AdminError('只有店长或管理员可以审核和冲销账目', 403);
  const input = parseAdminBody<FinanceInput>(req.body);
  const id = String(input.id || '').trim();
  if (!id) throw new AdminError('缺少账目 ID');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/finance_transactions?id=eq.${encodeURIComponent(id)}&select=${TRANSACTION_SELECT}&limit=1`, { method: 'GET' });
  const row = Array.isArray(rows) ? rows[0] as FinanceRow | undefined : undefined;
  if (!row) throw new AdminError('账目不存在', 404);
  enforceBranchAccess(admin, row.branch_id);
  if (row.status === 'voided') throw new AdminError('该账目已经冲销');

  if (input.action === 'approve') {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/finance_transactions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'approved', approved_by: admin.id, approved_at: new Date().toISOString() }),
    });
  } else if (input.action === 'void') {
    const reason = cleanText(input.note, 300);
    if (reason.length < 2) throw new AdminError('请填写冲销原因');
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/finance_transactions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'voided', voided_by: admin.id, voided_at: new Date().toISOString(), void_reason: reason }),
    });
  } else {
    throw new AdminError('操作不正确');
  }
  return res.status(200).json({ success: true });
}

function enforceBranchAccess(admin: Awaited<ReturnType<typeof requireAdminRole>>, requestedBranch: string) {
  if (admin.role === 'admin' || admin.role === 'owner') return requestedBranch;
  if (!admin.assignedBranchId) throw new AdminError('当前账号尚未分配门店，请联系管理员', 403);
  if (requestedBranch && requestedBranch !== admin.assignedBranchId) throw new AdminError('没有权限访问其他门店', 403);
  return admin.assignedBranchId;
}

function canAccessBranch(admin: Awaited<ReturnType<typeof requireAdminRole>>, branchId: string) {
  return admin.role === 'admin' || admin.role === 'owner' || admin.assignedBranchId === branchId;
}

function isRecognizedOrderIncome(order: OrderRow) {
  if (order.status === 'cancelled') return false;
  if (order.payment_method === 'cash') return order.status === 'completed';
  return order.payment_status === 'paid';
}

function normalizeRange(from: string | null, to: string | null) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 86400000);
  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : new Date(now.getTime() + 86400000);
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime()) || fromDate >= toDate) throw new AdminError('日期范围不正确');
  if (toDate.getTime() - fromDate.getTime() > 370 * 86400000) throw new AdminError('查询范围不能超过 370 天');
  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

function normalizeDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AdminError('发生时间不正确');
  return date.toISOString();
}

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

async function uploadReceipt(receipt: NonNullable<FinanceInput['receipt']>, branchId: string) {
  const contentType = String(receipt.contentType || '').toLowerCase();
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[contentType];
  if (!extension) throw new AdminError('收据只支持 JPG、PNG 或 WebP');
  const bytes = Buffer.from(String(receipt.dataBase64 || ''), 'base64');
  if (!bytes.length) throw new AdminError('收据图片为空');
  if (bytes.length > 5 * 1024 * 1024) throw new AdminError('收据图片不能超过 5MB');
  const path = `${branchId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/finance-receipts/${path}`, {
    method: 'POST', headers: { ...supabaseAuthHeaders(serviceRoleKey), 'Content-Type': contentType, 'x-upsert': 'false' }, body: bytes,
  });
  if (!response.ok) throw new AdminError(`收据上传失败：${await response.text()}`, response.status);
  return path;
}

async function signReceiptPaths(paths: string[]) {
  const result = new Map<string, string>();
  if (!paths.length) return result;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await Promise.all([...new Set(paths)].map(async path => {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/finance-receipts/${path}`, {
      method: 'POST', headers: { ...supabaseAuthHeaders(serviceRoleKey), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!response.ok) return;
    const payload = await response.json() as { signedURL?: string; signedUrl?: string };
    const signedPath = payload.signedURL || payload.signedUrl;
    if (signedPath) result.set(path, signedPath.startsWith('http') ? signedPath : `${supabaseUrl}/storage/v1${signedPath}`);
  }));
  return result;
}

function buildAnalytics(rows: { type: FinanceType; amount: number; categoryName: string; paymentMethod: string; occurredAt: string }[]) {
  const daily = new Map<string, { date: string; income: number; expense: number }>();
  const expenses = new Map<string, number>();
  const payments = new Map<string, number>();
  rows.forEach(row => {
    const date = row.occurredAt.slice(0, 10);
    const point = daily.get(date) || { date, income: 0, expense: 0 };
    point[row.type] += row.amount;
    daily.set(date, point);
    if (row.type === 'expense') expenses.set(row.categoryName, (expenses.get(row.categoryName) || 0) + row.amount);
    if (row.type === 'income') payments.set(row.paymentMethod, (payments.get(row.paymentMethod) || 0) + row.amount);
  });
  return {
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map(item => ({ ...item, income: roundMoney(item.income), expense: roundMoney(item.expense) })),
    expenses: [...expenses.entries()].map(([name, amount]) => ({ name, amount: roundMoney(amount) })).sort((a, b) => b.amount - a.amount),
    payments: [...payments.entries()].map(([name, amount]) => ({ name, amount: roundMoney(amount) })).sort((a, b) => b.amount - a.amount),
  };
}

function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
