import { AdminError, jsonError, parseAdminBody, requireAdminRole } from './_admin-utils';
import { ensureWallet, normalizeMalaysiaPhone, type UserRecord } from './_auth-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';
import {
  cleanAgentText,
  generateActivationCode,
  generateAgentNo,
  generateReferralCode,
  hashActivationCode,
  mapApplication,
  type AgentApplicationRow,
} from './_agent-utils';

type AdminAgentInput = {
  action?: 'approve' | 'reject' | 'request_changes' | 'resend_code' | 'bulk_create' | 'set_status' | 'delete_agent' | 'save_rule' | 'delete_rule' | 'adjust_commission' | 'review_payout' | 'review_profile_change';
  applicationId?: string;
  agentId?: string;
  status?: string;
  note?: string;
  entries?: { phone?: string; name?: string; commissionRate?: number | string }[];
  name?: string;
  commissionRate?: number | string;
  minOrderAmount?: number | string;
  ruleId?: string;
  amount?: number | string;
  payoutId?: string;
  payoutStatus?: string;
  profileChangeId?: string;
  profileChangeStatus?: string;
};

const ADMIN_ONLY_ACTIONS = new Set(['bulk_create', 'delete_agent', 'save_rule', 'delete_rule', 'adjust_commission', 'review_payout', 'review_profile_change']);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const admin = await requireAdminRole(req, ['admin', 'customer_service']);
    if ((req.method || 'GET') === 'GET') return await listAgentData(res, admin.role);
    if (req.method !== 'POST') {
      res.setHeader?.('Allow', 'GET, POST');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    const input = parseAdminBody<AdminAgentInput>(req.body);
    if (!input.action) throw new AdminError('缺少操作');
    if (ADMIN_ONLY_ACTIONS.has(input.action) && admin.role !== 'admin') throw new AdminError('只有管理员可以执行该操作', 403);
    if (input.action === 'approve' || input.action === 'resend_code') return await approveApplication(input, admin.id, res);
    if (input.action === 'reject' || input.action === 'request_changes') return await reviewApplication(input, admin.id, res);
    if (input.action === 'bulk_create') return await bulkCreateAgents(input, admin.id, res);
    if (input.action === 'set_status') return await setAgentStatus(input, admin.id, res);
    if (input.action === 'delete_agent') return await deleteAgent(input, admin.id, res);
    if (input.action === 'save_rule') return await saveRule(input, admin.id, res);
    if (input.action === 'delete_rule') return await deleteRule(input, admin.id, res);
    if (input.action === 'adjust_commission') return await adjustCommission(input, admin.id, res);
    if (input.action === 'review_payout') return await reviewPayout(input, admin.id, res);
    if (input.action === 'review_profile_change') return await reviewProfileChange(input, admin.id, res);
    throw new AdminError('不支持的操作');
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

async function listAgentData(res: ApiResponse, adminRole: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const [applicationsRaw, agentsRaw, rulesRaw, payoutsRaw, ledgerRaw, profileChangesRaw, attributionsRaw, auditRaw] = await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_applications?select=*,users(name,display_phone)&order=created_at.desc&limit=200', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agents?select=*,users(name,display_phone)&order=created_at.desc&limit=500', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_commission_rules?select=*&order=effective_from.desc&limit=100', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_payouts?select=*,agents(agent_no,referral_code,full_name,users(name,display_phone))&order=created_at.desc&limit=200', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_commission_ledger?select=*&order=created_at.desc&limit=500', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_profile_change_requests?select=*&order=created_at.desc&limit=200', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_order_attributions?select=*,orders(order_no)&order=created_at.desc&limit=500', { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_audit_logs?select=*,admin_users(display_name,username)&order=created_at.desc&limit=300', { method: 'GET' }),
  ]);
  const applications = (Array.isArray(applicationsRaw) ? applicationsRaw as any[] : []).map(row => ({ ...mapApplication(row as AgentApplicationRow), userName: row.users?.name || row.full_name, displayPhone: row.users?.display_phone || row.whatsapp_phone }));
  const ledger = Array.isArray(ledgerRaw) ? ledgerRaw as any[] : [];
  const balances = new Map<string, { pending: number; available: number; paid: number }>();
  for (const row of ledger) {
    const current = balances.get(row.agent_id) || { pending: 0, available: 0, paid: 0 };
    const amount = Number(row.amount || 0);
    if (row.status === 'pending') current.pending += amount;
    if (row.status === 'available') current.available += amount;
    if (row.status === 'paid' && row.entry_type === 'payout') {
      current.available += amount;
      current.paid += Math.abs(amount);
    }
    balances.set(row.agent_id, current);
  }
  const agents = (Array.isArray(agentsRaw) ? agentsRaw as any[] : []).map(row => ({
    id: row.id, agentNo: row.agent_no, userId: row.user_id, name: row.full_name || row.users?.name || '', displayPhone: row.whatsapp_phone || row.users?.display_phone || '', referralCode: row.referral_code,
    region: row.region || '', promotionChannel: row.promotion_channel || '',
    status: row.status, commissionRate: row.commission_rate == null ? null : Number(row.commission_rate), source: row.source, activatedAt: row.activated_at,
    balance: Object.fromEntries(Object.entries(balances.get(row.id) || { pending: 0, available: 0, paid: 0 }).map(([key, value]) => [key, roundMoney(value)])),
  }));
  const rules = (Array.isArray(rulesRaw) ? rulesRaw as any[] : []).map(row => ({ id: row.id, agentId: row.agent_id || null, name: row.name, commissionRate: Number(row.commission_rate), minOrderAmount: Number(row.min_order_amount), active: row.active, effectiveFrom: row.effective_from, effectiveUntil: row.effective_until || null }));
  const agentById = new Map(agents.map(row => [row.id, row]));
  const payouts = (Array.isArray(payoutsRaw) ? payoutsRaw as any[] : []).map(row => ({ id: row.id, payoutNo: row.payout_no, agentId: row.agent_id, agentNo: row.agents?.agent_no || '', name: row.agents?.full_name || row.agents?.users?.name || '', displayPhone: row.agents?.users?.display_phone || '', amount: Number(row.amount), paymentMethod: row.payment_method, paymentDetails: adminRole === 'admin' ? row.payment_details || {} : maskPaymentDetails(row.payment_details), status: row.status, requestedAt: row.requested_at, reviewNote: row.review_note || '' }));
  const profileChanges = (Array.isArray(profileChangesRaw) ? profileChangesRaw as any[] : []).map(row => ({ id: row.id, requestNo: row.request_no, agentId: row.agent_id, agentNo: agentById.get(row.agent_id)?.agentNo || '', currentName: agentById.get(row.agent_id)?.name || '', beforeData: row.before_data || {}, requestedData: row.requested_data || {}, reason: row.reason || '', status: row.status, reviewNote: row.review_note || '', createdAt: row.created_at, reviewedAt: row.reviewed_at || null }));
  const orders = (Array.isArray(attributionsRaw) ? attributionsRaw as any[] : []).map(row => ({ id: row.id, orderId: row.order_id, orderNo: row.orders?.order_no || '', agentId: row.agent_id, agentNo: agentById.get(row.agent_id)?.agentNo || '', name: agentById.get(row.agent_id)?.name || '', eligibleAmount: Number(row.eligible_amount), commissionRate: Number(row.commission_rate), commissionAmount: Number(row.commission_amount), status: row.status, createdAt: row.created_at }));
  const ledgerEntries = ledger.map(row => ({ id: row.id, agentId: row.agent_id, agentNo: agentById.get(row.agent_id)?.agentNo || '', name: agentById.get(row.agent_id)?.name || '', orderId: row.order_id || null, entryType: row.entry_type, amount: Number(row.amount), status: row.status, note: row.note || '', createdAt: row.created_at }));
  const auditLogs = (Array.isArray(auditRaw) ? auditRaw as any[] : []).map(row => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id || null, operator: row.admin_users?.display_name || row.admin_users?.username || '系统', note: row.note || '', beforeData: row.before_data, afterData: row.after_data, createdAt: row.created_at }));
  return res.status(200).json({ success: true, applications, agents, rules, payouts, profileChanges, orders, ledgerEntries, auditLogs });
}

function maskPaymentDetails(details: any) {
  const account = String(details?.accountNumber || '');
  return { bankName: details?.bankName || '', accountName: details?.accountName || '', accountNumber: account ? `****${account.slice(-4)}` : '' };
}

async function approveApplication(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.applicationId, 80);
  if (!id) throw new AdminError('缺少申请记录');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_applications?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: 'GET' });
  const application = Array.isArray(rows) ? rows[0] as AgentApplicationRow | undefined : undefined;
  if (!application || !['pending', 'changes_requested', 'approved'].includes(application.status)) throw new AdminError('该申请当前不能通过', 409);
  const code = generateActivationCode();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_activation_codes?application_id=eq.${encodeURIComponent(id)}&used_at=is.null&revoked_at=is.null`, { method: 'PATCH', body: JSON.stringify({ revoked_at: now }) });
  await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_applications?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved', reviewed_by: adminId, reviewed_at: now, review_note: cleanAgentText(input.note, 500) || null }) }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_activation_codes', { method: 'POST', body: JSON.stringify({ application_id: id, user_id: application.user_id, code_hash: hashActivationCode(code), expires_at: expiresAt, created_by: adminId }) }),
  ]);
  await audit(adminId, input.action === 'resend_code' ? 'resend_activation_code' : 'approve_application', 'agent_application', id, null, { status: 'approved', expiresAt });
  return res.status(200).json({ success: true, activationCode: code, expiresAt, applicationNo: application.application_no, warning: '代理码仅显示一次，请立即安全发送给申请人' });
}

async function reviewApplication(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.applicationId, 80);
  const note = cleanAgentText(input.note, 500);
  if (!id || !note) throw new AdminError('请填写审核原因');
  const status = input.action === 'reject' ? 'rejected' : 'changes_requested';
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_applications?id=eq.${encodeURIComponent(id)}&status=in.(pending,changes_requested)`, { method: 'PATCH', body: JSON.stringify({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString(), review_note: note }) });
  await audit(adminId, input.action || 'review', 'agent_application', id, null, { status, note });
  return res.status(200).json({ success: true, status });
}

async function bulkCreateAgents(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const entries = Array.isArray(input.entries) ? input.entries.slice(0, 200) : [];
  if (!entries.length) throw new AdminError('请提供至少一个手机号');
  const results: { phone: string; name?: string; success: boolean; agentNo?: string; referralCode?: string; error?: string }[] = [];
  for (const entry of entries) {
    const rawPhone = String(entry.phone || '');
    try {
      const realName = cleanAgentText(entry.name, 60);
      if (!realName) throw new Error('姓名为必填项，不能使用随机名称');
      const phone = normalizeMalaysiaPhone(rawPhone);
      const user = await findOrCreateAdminUser(phone.phone, phone.displayPhone, realName, adminId);
      const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
      const existing = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?user_id=eq.${encodeURIComponent(user.id)}&select=id,agent_no,referral_code&limit=1`, { method: 'GET' });
      if (Array.isArray(existing) && existing.length) throw new Error('该手机号已经是代理');
      const agentNo = generateAgentNo();
      const referralCode = generateReferralCode();
      const commissionRate = entry.commissionRate === undefined || entry.commissionRate === '' ? null : Number(entry.commissionRate);
      if (commissionRate !== null && (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)) throw new Error('佣金比例不正确');
      const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/agents', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ agent_no: agentNo, user_id: user.id, referral_code: referralCode, full_name: realName, whatsapp_phone: phone.displayPhone, commission_rate: commissionRate, source: entries.length > 1 ? 'admin_import' : 'admin_manual', created_by_admin_id: adminId }) });
      const agent = Array.isArray(created) ? created[0] as { id?: string } : null;
      await audit(adminId, 'manual_create_agent', 'agent', agent?.id || null, null, { phone: phone.displayPhone, agentNo, referralCode });
      results.push({ phone: phone.displayPhone, name: realName, success: true, agentNo, referralCode });
    } catch (error) {
      results.push({ phone: rawPhone, success: false, error: error instanceof Error ? error.message : '创建失败' });
    }
  }
  return res.status(200).json({ success: true, results, created: results.filter(row => row.success).length, failed: results.filter(row => !row.success).length });
}

async function setAgentStatus(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.agentId, 80);
  if (!id || !['active', 'suspended', 'terminated'].includes(String(input.status))) throw new AdminError('代理状态不正确');
  const note = cleanAgentText(input.note, 500);
  if (input.status !== 'active' && !note) throw new AdminError('停用代理时必须填写原因');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: input.status, suspended_at: input.status === 'active' ? null : new Date().toISOString(), suspension_reason: input.status === 'active' ? null : note }) });
  await audit(adminId, 'set_agent_status', 'agent', id, null, { status: input.status, note });
  return res.status(200).json({ success: true });
}

async function deleteAgent(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.agentId, 80);
  if (!id) throw new AdminError('缺少代理记录');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/delete_agent_if_safe', {
    method: 'POST',
    body: JSON.stringify({ agent_id_input: id, admin_id_input: adminId }),
  });
  return res.status(200).json({ success: true, result });
}

async function saveRule(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const rate = Number(input.commissionRate);
  const minOrder = Number(input.minOrderAmount || 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AdminError('佣金比例应为0至100');
  if (!Number.isFinite(minOrder) || minOrder < 0) throw new AdminError('最低订单金额不正确');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const agentId = cleanAgentText(input.agentId, 80) || null;
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_rules?agent_id=${agentId ? `eq.${encodeURIComponent(agentId)}` : 'is.null'}&active=eq.true`, { method: 'PATCH', body: JSON.stringify({ active: false, effective_until: new Date().toISOString() }) });
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_commission_rules', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ agent_id: agentId, name: cleanAgentText(input.name, 100) || (agentId ? '代理专属佣金' : '默认佣金'), commission_rate: rate, min_order_amount: minOrder, created_by: adminId }) });
  const rule = Array.isArray(created) ? created[0] as { id?: string } : null;
  await audit(adminId, 'save_commission_rule', 'commission_rule', rule?.id || null, null, { agentId, rate, minOrder });
  return res.status(201).json({ success: true, rule });
}

async function deleteRule(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.ruleId, 80);
  if (!id) throw new AdminError('缺少佣金规则');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_rules?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: 'GET' });
  const rule = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
  if (!rule) throw new AdminError('佣金规则不存在', 404);
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_rules?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  await audit(adminId, 'delete_commission_rule', 'commission_rule', id, rule, null);
  return res.status(200).json({ success: true });
}

async function adjustCommission(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const agentId = cleanAgentText(input.agentId, 80);
  const amount = roundMoney(Number(input.amount));
  const note = cleanAgentText(input.note, 500);
  if (!agentId || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) throw new AdminError('调整金额不正确');
  if (!note) throw new AdminError('佣金调整必须填写原因');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const row = await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_commission_ledger', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ agent_id: agentId, entry_type: amount > 0 ? 'adjustment' : 'reversal', amount, status: 'available', note, created_by: adminId, available_at: new Date().toISOString() }) });
  const created = Array.isArray(row) ? row[0] as { id?: string } : null;
  await audit(adminId, 'adjust_commission', 'commission_ledger', created?.id || null, null, { agentId, amount, note });
  return res.status(201).json({ success: true });
}

async function reviewPayout(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.payoutId, 80);
  const status = String(input.payoutStatus || '');
  if (!id || !['approved', 'paid', 'rejected'].includes(status)) throw new AdminError('提现审核状态不正确');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_payouts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: 'GET' });
  const payout = Array.isArray(rows) ? rows[0] as any : null;
  if (!payout || !['pending', 'approved'].includes(payout.status)) throw new AdminError('该提现申请当前不能审核', 409);
  const now = new Date().toISOString();
  if (status === 'paid') {
    await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_commission_ledger?on_conflict=payout_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ agent_id: payout.agent_id, payout_id: payout.id, entry_type: 'payout', amount: -Number(payout.amount), status: 'paid', note: `提现 ${payout.payout_no}`, created_by: adminId, paid_at: now }) });
  }
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_payouts?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, reviewed_by: adminId, reviewed_at: now, paid_at: status === 'paid' ? now : null, review_note: cleanAgentText(input.note, 500) || null }) });
  await audit(adminId, 'review_payout', 'agent_payout', id, { status: payout.status }, { status, note: input.note || '' });
  return res.status(200).json({ success: true });
}

async function reviewProfileChange(input: AdminAgentInput, adminId: string, res: ApiResponse) {
  const id = cleanAgentText(input.profileChangeId, 80);
  const status = String(input.profileChangeStatus || '');
  const note = cleanAgentText(input.note, 500);
  if (!id || !['approved', 'rejected', 'changes_requested'].includes(status)) throw new AdminError('资料审核状态不正确');
  if (status !== 'approved' && !note) throw new AdminError('请填写审核说明');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_profile_change_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: 'GET' });
  const request = Array.isArray(rows) ? rows[0] as any : null;
  if (!request || !['pending', 'changes_requested'].includes(request.status)) throw new AdminError('该资料申请当前不能审核', 409);
  const now = new Date().toISOString();
  if (status === 'approved') {
    const next = request.requested_data || {};
    if (!next.fullName || !next.region || !next.promotionChannel || !next.whatsappPhone) throw new AdminError('待审核资料不完整');
    await Promise.all([
      supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?id=eq.${encodeURIComponent(request.agent_id)}`, { method: 'PATCH', body: JSON.stringify({ full_name: cleanAgentText(next.fullName, 60), region: cleanAgentText(next.region, 80), promotion_channel: cleanAgentText(next.promotionChannel, 120), whatsapp_phone: cleanAgentText(next.whatsappPhone, 30) }) }),
      supabaseRequest(supabaseUrl, serviceRoleKey, `/users?id=eq.${encodeURIComponent(request.user_id)}`, { method: 'PATCH', body: JSON.stringify({ name: cleanAgentText(next.fullName, 60) }) }),
    ]);
  }
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_profile_change_requests?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, reviewed_by: adminId, reviewed_at: now, review_note: note || null }) });
  await audit(adminId, 'review_agent_profile_change', 'agent_profile_change', id, request.before_data, { status, requestedData: request.requested_data, note });
  return res.status(200).json({ success: true, status });
}

async function findOrCreateAdminUser(phone: string, displayPhone: string, name: string, adminId: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/users?phone=eq.${encodeURIComponent(phone)}&select=*&limit=1`, { method: 'GET' });
  const existing = Array.isArray(rows) ? rows[0] as UserRecord | undefined : undefined;
  if (existing) {
    if (existing.name !== name) await supabaseRequest(supabaseUrl, serviceRoleKey, `/users?id=eq.${encodeURIComponent(existing.id)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    await ensureWallet(existing.id);
    return existing;
  }
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/users', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ phone, display_phone: displayPhone, name, source: 'admin_created', created_by_admin_id: adminId }) });
  const user = Array.isArray(created) ? created[0] as UserRecord | undefined : undefined;
  if (!user) throw new Error('会员账号创建失败');
  await ensureWallet(user.id);
  return user;
}

async function audit(adminId: string, action: string, entityType: string, entityId: string | null, beforeData: unknown, afterData: unknown) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_audit_logs', { method: 'POST', body: JSON.stringify({ admin_user_id: adminId, action, entity_type: entityType, entity_id: entityId, before_data: beforeData, after_data: afterData }) });
}
