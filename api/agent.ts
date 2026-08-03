import type { ApiRequest, ApiResponse } from './_order-utils';
import { getAuthenticatedUser, normalizeMalaysiaPhone } from './_auth-utils';
import { getSupabaseConfig, sendTelegramNotification, supabaseRequest } from './_order-utils';
import {
  bindReferralToUser,
  buildAgentWhatsappUrl,
  cleanAgentText,
  generateAgentNo,
  generateApplicationNo,
  generateReferralCode,
  getAgentPortal,
  hashActivationCode,
  normalizeActivationCode,
} from './_agent-utils';

type AgentInput = {
  action?: 'apply' | 'activate' | 'bind_referral' | 'request_payout' | 'request_profile_change';
  fullName?: string;
  region?: string;
  promotionChannel?: string;
  whatsappPhone?: string;
  message?: string;
  consent?: boolean;
  activationCode?: string;
  referralCode?: string;
  amount?: number | string;
  paymentMethod?: string;
  paymentDetails?: Record<string, string>;
  language?: string;
  reason?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ success: false, error: '请先登录后使用代理合作功能' });
    if ((req.method || 'GET') === 'GET') return res.status(200).json({ success: true, ...(await getAgentPortal(user.id, requestLanguage(req))) });
    if (req.method !== 'POST') {
      res.setHeader?.('Allow', 'GET, POST');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    const input = parseBody<AgentInput>(req.body);
    if (input.action === 'apply') return await applyForAgent(user, input, res);
    if (input.action === 'activate') return await activateAgent(user.id, input, res);
    if (input.action === 'bind_referral') return await bindReferral(user.id, input, res);
    if (input.action === 'request_payout') return await requestPayout(user.id, input, res);
    if (input.action === 'request_profile_change') return await requestProfileChange(user.id, input, res);
    return res.status(400).json({ success: false, error: '操作不正确' });
  } catch (error) {
    const message = normalizeAgentError(error);
    return res.status(message.statusCode).json({ success: false, error: message.message });
  }
}

async function requestProfileChange(userId: string, input: AgentInput, res: ApiResponse) {
  const requestedData = {
    fullName: cleanAgentText(input.fullName, 60),
    region: cleanAgentText(input.region, 80),
    promotionChannel: cleanAgentText(input.promotionChannel, 120),
    whatsappPhone: normalizeMalaysiaPhone(String(input.whatsappPhone || '')).displayPhone,
  };
  if (!requestedData.fullName || !requestedData.region || !requestedData.promotionChannel || !requestedData.whatsappPhone) {
    throw new Error('请完整填写姓名、地区、推广渠道和 WhatsApp 手机号');
  }
  const reason = cleanAgentText(input.reason, 300);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?user_id=eq.${encodeURIComponent(userId)}&select=id,full_name,region,promotion_channel,whatsapp_phone,status&limit=1`, { method: 'GET' });
  const agent = Array.isArray(rows) ? rows[0] as any : null;
  if (!agent || agent.status === 'terminated') throw new Error('当前代理状态不能修改资料');
  const openRows = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_profile_change_requests?agent_id=eq.${encodeURIComponent(agent.id)}&status=in.(pending,changes_requested)&select=id,request_no,status&limit=1`, { method: 'GET' });
  const open = Array.isArray(openRows) ? openRows[0] as any : null;
  const beforeData = { fullName: agent.full_name || '', region: agent.region || '', promotionChannel: agent.promotion_channel || '', whatsappPhone: agent.whatsapp_phone || '' };
  if (JSON.stringify(beforeData) === JSON.stringify(requestedData)) throw new Error('资料没有发生变化');
  if (open?.status === 'pending') return res.status(409).json({ success: false, error: '已有待审核的资料修改申请' });
  if (open?.status === 'changes_requested') {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_profile_change_requests?id=eq.${encodeURIComponent(open.id)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ before_data: beforeData, requested_data: requestedData, reason: reason || null, status: 'pending', reviewed_by: null, reviewed_at: null, review_note: null }),
    });
    return res.status(200).json({ success: true, requestNo: open.request_no });
  }
  const requestNo = `APC${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_profile_change_requests', {
    method: 'POST',
    body: JSON.stringify({ request_no: requestNo, agent_id: agent.id, user_id: userId, before_data: beforeData, requested_data: requestedData, reason: reason || null }),
  });
  await sendTelegramNotification(`🪪 代理资料修改待审核\n申请编号：${requestNo}\n姓名：${requestedData.fullName}\n手机号：${requestedData.whatsappPhone}`).catch(() => undefined);
  return res.status(201).json({ success: true, requestNo });
}

async function applyForAgent(user: { id: string; display_phone: string; name?: string | null }, input: AgentInput, res: ApiResponse) {
  const fullName = cleanAgentText(input.fullName || user.name, 60);
  const region = cleanAgentText(input.region, 80);
  const promotionChannel = cleanAgentText(input.promotionChannel, 120);
  const message = cleanAgentText(input.message, 800);
  if (!fullName || !region || !promotionChannel) throw new Error('请完整填写姓名、地区和推广渠道');
  if (!input.consent) throw new Error('请阅读并同意代理规则及隐私说明');
  const whatsappPhone = normalizeMalaysiaPhone(String(input.whatsappPhone || user.display_phone)).displayPhone;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const existing = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_applications?user_id=eq.${encodeURIComponent(user.id)}&status=in.(pending,changes_requested,approved)&select=id,status,application_no&limit=1`, { method: 'GET' });
  const openApplication = Array.isArray(existing) ? existing[0] as { id: string; status: string; application_no: string } | undefined : undefined;
  if (openApplication?.status === 'changes_requested') {
    await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_applications?id=eq.${encodeURIComponent(openApplication.id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ full_name: fullName, region, promotion_channel: promotionChannel, whatsapp_phone: whatsappPhone, message: message || null, status: 'pending', consent_at: new Date().toISOString(), review_note: null, reviewed_at: null, reviewed_by: null }),
    });
    await sendTelegramNotification(`📝 代理申请已补充资料\n申请编号：${openApplication.application_no}\n姓名：${fullName}\n手机号：${whatsappPhone}`).catch(() => undefined);
    return res.status(200).json({ success: true, applicationNo: openApplication.application_no, whatsappUrl: buildAgentWhatsappUrl(openApplication.application_no, input.language) });
  }
  if (openApplication) return res.status(409).json({ success: false, error: '你已有进行中的代理申请，请勿重复提交' });
  const existingAgent = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`, { method: 'GET' });
  if (Array.isArray(existingAgent) && existingAgent.length) return res.status(409).json({ success: false, error: '该账号已经是代理' });
  const applicationNo = generateApplicationNo();
  const created = await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_applications', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ application_no: applicationNo, user_id: user.id, full_name: fullName, region, promotion_channel: promotionChannel, whatsapp_phone: whatsappPhone, message: message || null, consent_at: new Date().toISOString() }),
  });
  const application = Array.isArray(created) ? created[0] : created;
  await sendTelegramNotification(`🤝 新代理申请\n申请编号：${applicationNo}\n姓名：${fullName}\n手机号：${whatsappPhone}\n地区：${region}\n渠道：${promotionChannel}`).catch(() => undefined);
  return res.status(201).json({ success: true, application, whatsappUrl: buildAgentWhatsappUrl(applicationNo, input.language) });
}

async function activateAgent(userId: string, input: AgentInput, res: ApiResponse) {
  const code = normalizeActivationCode(input.activationCode || '');
  if (code.length !== 8) throw new Error('请输入8位一次性代理码');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const result = await supabaseRequest(supabaseUrl, serviceRoleKey, '/rpc/activate_agent_with_code', {
    method: 'POST',
    body: JSON.stringify({ user_id_input: userId, code_hash_input: hashActivationCode(code), agent_no_input: generateAgentNo(), referral_code_input: generateReferralCode() }),
  });
  if (result === 'INVALID') throw new Error('ACTIVATION_CODE_INVALID');
  if (result === 'LOCKED') throw new Error('ACTIVATION_CODE_LOCKED');
  if (result === 'UNAVAILABLE') throw new Error('ACTIVATION_CODE_UNAVAILABLE');
  return res.status(200).json({ success: true, agentId: result });
}

async function bindReferral(userId: string, input: AgentInput, res: ApiResponse) {
  const result = await bindReferralToUser(userId, String(input.referralCode || ''));
  return res.status(200).json({ success: true, ...result });
}

async function requestPayout(userId: string, input: AgentInput, res: ApiResponse) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 10 || amount > 100000) throw new Error('提现金额最低 RM 10');
  const paymentDetails = {
    bankName: cleanAgentText(input.paymentDetails?.bankName, 80),
    accountName: cleanAgentText(input.paymentDetails?.accountName, 100),
    accountNumber: cleanAgentText(input.paymentDetails?.accountNumber, 50),
  };
  if (!paymentDetails.bankName || !paymentDetails.accountName || !paymentDetails.accountNumber) throw new Error('请完整填写银行和收款账号资料');
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const agents = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id&limit=1`, { method: 'GET' });
  const agent = Array.isArray(agents) ? agents[0] as { id: string } | undefined : undefined;
  if (!agent) throw new Error('代理状态不可提现');
  const ledger = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_ledger?agent_id=eq.${encodeURIComponent(agent.id)}&select=amount,status,entry_type`, { method: 'GET' });
  const available = (Array.isArray(ledger) ? ledger : [])
    .filter((row: any) => row.status === 'available' || (row.status === 'paid' && row.entry_type === 'payout'))
    .reduce((sum, row: any) => sum + Number(row.amount || 0), 0);
  const pendingPayouts = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_payouts?agent_id=eq.${encodeURIComponent(agent.id)}&status=in.(pending,approved)&select=amount`, { method: 'GET' });
  const reserved = (Array.isArray(pendingPayouts) ? pendingPayouts : []).reduce((sum, row: any) => sum + Number(row.amount || 0), 0);
  if (amount > available - reserved) throw new Error('可提现佣金余额不足');
  const payoutNo = `AP${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_payouts', { method: 'POST', body: JSON.stringify({ payout_no: payoutNo, agent_id: agent.id, amount, payment_method: 'bank', payment_details: paymentDetails }) });
  return res.status(201).json({ success: true, payoutNo });
}

function parseBody<T>(body: unknown) {
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as T;
  if (typeof body === 'string') return JSON.parse(body) as T;
  return (body || {}) as T;
}

function requestLanguage(req: ApiRequest) {
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams.get('lang');
  } catch {
    return null;
  }
}

function normalizeAgentError(error: unknown) {
  const raw = error instanceof Error ? error.message : '代理操作失败';
  if (raw.includes('ACTIVATION_CODE_INVALID')) return { statusCode: 400, message: '代理码不正确' };
  if (raw.includes('ACTIVATION_CODE_LOCKED')) return { statusCode: 429, message: '代理码错误次数过多，请联系客服重新生成' };
  if (raw.includes('ACTIVATION_CODE_UNAVAILABLE')) return { statusCode: 400, message: '代理码不存在、已使用或已过期' };
  if (raw.includes('duplicate key') || raw.includes('23505')) return { statusCode: 409, message: '记录已存在，请勿重复操作' };
  return { statusCode: 400, message: raw };
}
