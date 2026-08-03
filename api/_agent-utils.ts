import { createHmac, randomBytes } from 'node:crypto';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';

export type AgentApplicationStatus = 'pending' | 'changes_requested' | 'approved' | 'rejected' | 'activated';
export type AgentStatus = 'active' | 'suspended' | 'terminated';

export type AgentApplicationRow = {
  id: string;
  application_no: string;
  user_id: string;
  full_name: string;
  region: string;
  promotion_channel: string;
  whatsapp_phone: string;
  message?: string | null;
  status: AgentApplicationStatus;
  consent_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRow = {
  id: string;
  agent_no: string;
  user_id: string;
  referral_code: string;
  full_name?: string | null;
  region?: string | null;
  promotion_channel?: string | null;
  whatsapp_phone?: string | null;
  status: AgentStatus;
  commission_rate?: number | string | null;
  source: 'application' | 'admin_manual' | 'admin_import';
  application_id?: string | null;
  activated_at: string;
  created_at: string;
};

type CommissionLedgerRow = {
  id: string;
  agent_id: string;
  order_id?: string | null;
  entry_type: 'commission' | 'adjustment' | 'reversal' | 'payout';
  amount: number | string;
  status: 'pending' | 'available' | 'paid' | 'voided';
  note?: string | null;
  available_at?: string | null;
  paid_at?: string | null;
  created_at: string;
};

type AgentAttributionRow = {
  id: string;
  order_id: string;
  eligible_amount: number | string;
  commission_rate: number | string;
  commission_amount: number | string;
  status: 'pending' | 'available' | 'voided' | 'paid';
  created_at: string;
};

type AgentPayoutRow = {
  id: string;
  payout_no: string;
  amount: number | string;
  payment_details?: { bankName?: string; accountNumber?: string } | null;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  requested_at: string;
  paid_at?: string | null;
  review_note?: string | null;
};

export function cleanAgentText(value: unknown, maxLength: number) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
}

export function generateApplicationNo() {
  return `AGP${compactDate()}${randomDigits(5)}`;
}

export function generateAgentNo() {
  return `AG${compactDate()}${randomDigits(5)}`;
}

export function generateReferralCode() {
  return `SCT${randomBytes(5).toString('hex').toUpperCase()}`;
}

export function generateActivationCode() {
  return Array.from(randomBytes(8), byte => String(byte % 10)).join('');
}

export function hashActivationCode(code: string) {
  const secret = process.env.AGENT_CODE_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('AGENT_CODE_SECRET 或 SESSION_SECRET 配置不安全');
  return createHmac('sha256', secret).update(normalizeActivationCode(code)).digest('hex');
}

export function normalizeActivationCode(code: string) {
  return String(code || '').replace(/\D/g, '').slice(0, 8);
}

type AgentPortalLanguage = 'zh' | 'en' | 'th' | 'vi';

const MALAYSIA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function malaysiaPeriodStart(days: number, now = new Date()) {
  const malaysiaNow = new Date(now.getTime() + MALAYSIA_UTC_OFFSET_MS);
  return Date.UTC(
    malaysiaNow.getUTCFullYear(),
    malaysiaNow.getUTCMonth(),
    malaysiaNow.getUTCDate() - Math.max(0, days - 1),
  ) - MALAYSIA_UTC_OFFSET_MS;
}

function normalizeAgentPortalLanguage(value?: string | null): AgentPortalLanguage {
  const language = String(value || '').toLowerCase().split('-')[0];
  return ['zh', 'en', 'th', 'vi'].includes(language) ? language as AgentPortalLanguage : 'en';
}

export function buildAgentWhatsappUrl(applicationNo: string, language?: string | null) {
  const configured = process.env.WHATSAPP_URL || process.env.VITE_WHATSAPP_URL || '';
  if (!configured) return '';
  const messages: Record<AgentPortalLanguage, string> = {
    zh: `你好，我已经提交成为代理的申请。\n申请编号：${applicationNo}\n请协助审核，谢谢。`,
    en: `Hello, I have submitted an agent application.\nApplication number: ${applicationNo}\nPlease assist with the review. Thank you.`,
    th: `สวัสดี ฉันได้ส่งใบสมัครเป็นตัวแทนแล้ว\nหมายเลขใบสมัคร: ${applicationNo}\nกรุณาช่วยตรวจสอบให้ด้วย ขอบคุณค่ะ/ครับ`,
    vi: `Xin chào, tôi đã gửi đơn đăng ký làm đại lý.\nMã đơn đăng ký: ${applicationNo}\nVui lòng hỗ trợ xét duyệt. Xin cảm ơn.`,
  };
  try {
    const url = new URL(configured);
    url.searchParams.set('text', messages[normalizeAgentPortalLanguage(language)]);
    return url.toString();
  } catch {
    return configured;
  }
}

export async function getAgentPortal(userId: string, language?: string | null) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const [applicationRaw, agentRaw, profileChangeRaw] = await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_applications?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=1`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_profile_change_requests?user_id=eq.${encodeURIComponent(userId)}&select=id,request_no,requested_data,reason,status,review_note,created_at,reviewed_at&order=created_at.desc&limit=1`, { method: 'GET' }),
  ]);
  const application = Array.isArray(applicationRaw) ? applicationRaw[0] as AgentApplicationRow | undefined : undefined;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] as AgentRow | undefined : undefined;
  const profileChange = Array.isArray(profileChangeRaw) ? profileChangeRaw[0] as any : undefined;
  if (!agent) {
    return {
      application: application ? mapApplication(application) : null,
      agent: null,
      summary: { pending: 0, available: 0, paid: 0, referrals: 0, orders: 0, todayEarnings: 0, sevenDayEarnings: 0, thirtyDayEarnings: 0, totalEarnings: 0, todayOrders: 0, sevenDayOrders: 0, thirtyDayOrders: 0 },
      commissions: [],
      orders: [],
      payouts: [],
      profileChangeRequest: profileChange ? mapProfileChange(profileChange) : null,
      whatsappUrl: application ? buildAgentWhatsappUrl(application.application_no, language) : '',
    };
  }

  const [ledgerRaw, ledgerSummaryRaw, referralsRaw, attributionsRaw, attributionSummaryRaw, payoutsRaw] = await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_ledger?agent_id=eq.${encodeURIComponent(agent.id)}&select=*&order=created_at.desc&limit=50`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_ledger?agent_id=eq.${encodeURIComponent(agent.id)}&select=amount,status,entry_type,created_at`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_referrals?agent_id=eq.${encodeURIComponent(agent.id)}&select=id`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_order_attributions?agent_id=eq.${encodeURIComponent(agent.id)}&select=id,order_id,eligible_amount,commission_rate,commission_amount,status,created_at&order=created_at.desc&limit=100`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_order_attributions?agent_id=eq.${encodeURIComponent(agent.id)}&select=id,created_at`, { method: 'GET' }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_payouts?agent_id=eq.${encodeURIComponent(agent.id)}&select=id,payout_no,amount,payment_details,status,requested_at,paid_at,review_note&order=requested_at.desc&limit=50`, { method: 'GET' }),
  ]);
  const ledger = Array.isArray(ledgerRaw) ? ledgerRaw as CommissionLedgerRow[] : [];
  const ledgerSummary = Array.isArray(ledgerSummaryRaw) ? ledgerSummaryRaw as CommissionLedgerRow[] : [];
  const attributions = Array.isArray(attributionsRaw) ? attributionsRaw as AgentAttributionRow[] : [];
  const attributionSummary = Array.isArray(attributionSummaryRaw) ? attributionSummaryRaw as Pick<AgentAttributionRow, 'id' | 'created_at'>[] : [];
  const payouts = Array.isArray(payoutsRaw) ? payoutsRaw as AgentPayoutRow[] : [];
  const orderIds = attributions.map(row => row.order_id).filter(Boolean);
  const ordersRaw = orderIds.length
    ? await supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=in.(${orderIds.map(encodeURIComponent).join(',')})&select=id,order_no`, { method: 'GET' })
    : [];
  const orderNumberById = new Map((Array.isArray(ordersRaw) ? ordersRaw : []).map((row: any) => [String(row.id), String(row.order_no || '')]));
  const sumStatus = (status: CommissionLedgerRow['status']) => roundMoney(ledgerSummary.filter(row => row.status === status).reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const paidPayouts = ledgerSummary.filter(row => row.status === 'paid' && row.entry_type === 'payout').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const earnings = ledgerSummary.filter(row => row.entry_type !== 'payout' && row.status !== 'voided');
  const sumEarningsSince = (startTime: number) => roundMoney(earnings.reduce((sum, row) => {
    const createdAt = new Date(row.created_at).getTime();
    return Number.isFinite(createdAt) && createdAt >= startTime ? sum + Number(row.amount || 0) : sum;
  }, 0));
  const totalEarnings = roundMoney(earnings.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const countOrdersSince = (startTime: number) => attributionSummary.reduce((count, row) => {
    const createdAt = new Date(row.created_at).getTime();
    return Number.isFinite(createdAt) && createdAt >= startTime ? count + 1 : count;
  }, 0);
  const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    application: application ? mapApplication(application) : null,
    agent: {
      id: agent.id,
      agentNo: agent.agent_no,
      referralCode: agent.referral_code,
      referralUrl: `${siteUrl}/?ref=${encodeURIComponent(agent.referral_code)}`,
      fullName: cleanAgentText(agent.full_name || application?.full_name, 60),
      region: cleanAgentText(agent.region || application?.region, 80),
      promotionChannel: cleanAgentText(agent.promotion_channel || application?.promotion_channel, 120),
      whatsappPhone: cleanAgentText(agent.whatsapp_phone || application?.whatsapp_phone, 30),
      status: agent.status,
      commissionRate: agent.commission_rate == null ? null : Number(agent.commission_rate),
      activatedAt: agent.activated_at,
    },
    summary: {
      pending: sumStatus('pending'),
      available: roundMoney(sumStatus('available') + paidPayouts),
      paid: roundMoney(Math.abs(paidPayouts)),
      referrals: Array.isArray(referralsRaw) ? referralsRaw.length : 0,
      orders: attributionSummary.length,
      todayEarnings: sumEarningsSince(malaysiaPeriodStart(1)),
      sevenDayEarnings: sumEarningsSince(malaysiaPeriodStart(7)),
      thirtyDayEarnings: sumEarningsSince(malaysiaPeriodStart(30)),
      totalEarnings,
      todayOrders: countOrdersSince(malaysiaPeriodStart(1)),
      sevenDayOrders: countOrdersSince(malaysiaPeriodStart(7)),
      thirtyDayOrders: countOrdersSince(malaysiaPeriodStart(30)),
    },
    commissions: ledger.map(row => ({
      id: row.id,
      orderId: row.order_id || null,
      type: row.entry_type,
      amount: Number(row.amount),
      status: row.status,
      note: row.note || null,
      createdAt: row.created_at,
      availableAt: row.available_at || null,
      paidAt: row.paid_at || null,
    })),
    orders: attributions.map(row => ({
      id: row.id,
      orderId: row.order_id,
      orderNo: orderNumberById.get(row.order_id) || row.order_id.slice(0, 8).toUpperCase(),
      eligibleAmount: Number(row.eligible_amount),
      commissionRate: Number(row.commission_rate),
      commissionAmount: Number(row.commission_amount),
      status: row.status,
      createdAt: row.created_at,
    })),
    payouts: payouts.map(row => ({
      id: row.id,
      payoutNo: row.payout_no,
      amount: Number(row.amount),
      status: row.status,
      bankName: cleanAgentText(row.payment_details?.bankName, 80),
      maskedAccountNumber: maskBankAccount(row.payment_details?.accountNumber),
      reviewNote: row.review_note || '',
      requestedAt: row.requested_at,
      paidAt: row.paid_at || null,
    })),
    profileChangeRequest: profileChange ? mapProfileChange(profileChange) : null,
    whatsappUrl: '',
  };
}

function mapProfileChange(row: any) {
  return {
    id: String(row.id),
    requestNo: String(row.request_no || ''),
    requestedData: row.requested_data || {},
    reason: String(row.reason || ''),
    status: row.status,
    reviewNote: String(row.review_note || ''),
    createdAt: String(row.created_at || ''),
    reviewedAt: row.reviewed_at || null,
  };
}

function maskBankAccount(value?: string | null) {
  const account = String(value || '').replace(/\s/g, '');
  if (!account) return '';
  if (account.length <= 4) return account;
  return `${'*'.repeat(Math.min(account.length - 4, 8))}${account.slice(-4)}`;
}

export async function bindReferralToUser(userId: string, referralCode: string) {
  const normalized = cleanAgentText(referralCode, 32).toUpperCase();
  if (!normalized) return { bound: false, reason: 'missing' as const };
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const agents = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agents?referral_code=eq.${encodeURIComponent(normalized)}&status=eq.active&select=id,user_id,referral_code&limit=1`, { method: 'GET' });
  const agent = Array.isArray(agents) ? agents[0] as { id: string; user_id: string; referral_code: string } | undefined : undefined;
  if (!agent) return { bound: false, reason: 'invalid' as const };
  if (agent.user_id === userId) return { bound: false, reason: 'self_referral' as const };
  const existing = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_referrals?referred_user_id=eq.${encodeURIComponent(userId)}&select=id,agent_id&limit=1`, { method: 'GET' });
  if (Array.isArray(existing) && existing.length) return { bound: false, reason: 'already_bound' as const };
  await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_referrals', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agent.id, referred_user_id: userId, referral_code: agent.referral_code }),
  });
  return { bound: true };
}

export async function attributeOrderToAgent(params: {
  orderId: string;
  userId?: string | null;
  subtotal: number;
  discountAmount: number;
}) {
  if (!params.userId) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const referrals = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_referrals?referred_user_id=eq.${encodeURIComponent(params.userId)}&select=agent_id,referral_code,agents(id,status,commission_rate)&limit=1`, { method: 'GET' });
  const referral = Array.isArray(referrals) ? referrals[0] as any : null;
  if (!referral?.agent_id || referral.agents?.status !== 'active') return;
  const now = new Date().toISOString();
  const rules = await supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_rules?${[
    'active=eq.true',
    `effective_from=lte.${encodeURIComponent(now)}`,
    'select=id,agent_id,name,commission_rate,min_order_amount,effective_from,effective_until',
    'order=effective_from.desc',
    'limit=100',
  ].join('&')}`, { method: 'GET' });
  const ruleRows = (Array.isArray(rules) ? rules as any[] : []).filter(row => !row.effective_until || new Date(row.effective_until).getTime() > Date.now());
  const rule = ruleRows.find(row => row.agent_id === referral.agent_id) || ruleRows.find(row => !row.agent_id);
  const rate = Number(referral.agents?.commission_rate ?? rule?.commission_rate ?? 0);
  const eligibleAmount = roundMoney(Math.max(params.subtotal - params.discountAmount, 0));
  if (rate <= 0 || eligibleAmount < Number(rule?.min_order_amount || 0)) return;
  const commissionAmount = roundMoney(eligibleAmount * rate / 100);
  const attributionRaw = await supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_order_attributions', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      order_id: params.orderId,
      agent_id: referral.agent_id,
      referred_user_id: params.userId,
      referral_code: referral.referral_code,
      eligible_amount: eligibleAmount,
      commission_rate: rate,
      commission_amount: commissionAmount,
      rule_snapshot: rule || { name: '代理专属比例', commission_rate: rate },
    }),
  });
  const attribution = Array.isArray(attributionRaw) ? attributionRaw[0] as { id?: string } : null;
  await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/orders?id=eq.${encodeURIComponent(params.orderId)}`, { method: 'PATCH', body: JSON.stringify({ agent_id: referral.agent_id, agent_referral_code: referral.referral_code }) }),
    supabaseRequest(supabaseUrl, serviceRoleKey, '/agent_commission_ledger', {
      method: 'POST',
      body: JSON.stringify({ agent_id: referral.agent_id, order_id: params.orderId, attribution_id: attribution?.id || null, entry_type: 'commission', amount: commissionAmount, status: 'pending', note: '订单佣金' }),
    }),
  ]);
}

export async function syncOrderCommissionStatus(orderId: string, orderStatus: string) {
  if (!['completed', 'cancelled'].includes(orderStatus)) return;
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const nextStatus = orderStatus === 'completed' ? 'available' : 'voided';
  const now = new Date().toISOString();
  await Promise.all([
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_order_attributions?order_id=eq.${encodeURIComponent(orderId)}&status=eq.pending`, {
      method: 'PATCH', body: JSON.stringify(orderStatus === 'completed' ? { status: nextStatus, available_at: now } : { status: nextStatus, voided_at: now, void_reason: '订单已取消' }),
    }),
    supabaseRequest(supabaseUrl, serviceRoleKey, `/agent_commission_ledger?order_id=eq.${encodeURIComponent(orderId)}&entry_type=eq.commission&status=eq.pending`, {
      method: 'PATCH', body: JSON.stringify(orderStatus === 'completed' ? { status: nextStatus, available_at: now } : { status: nextStatus, note: '订单已取消，佣金作废' }),
    }),
  ]);
}

export function mapApplication(row: AgentApplicationRow) {
  return {
    id: row.id,
    applicationNo: row.application_no,
    fullName: row.full_name,
    region: row.region,
    promotionChannel: row.promotion_channel,
    whatsappPhone: row.whatsapp_phone,
    message: row.message || '',
    status: row.status,
    reviewNote: row.review_note || '',
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || null,
  };
}

function compactDate() {
  return new Date().toISOString().slice(2, 10).replace(/-/g, '');
}

function randomDigits(length: number) {
  return Array.from(randomBytes(length), byte => String(byte % 10)).join('');
}
