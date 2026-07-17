import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, Check, Copy, RefreshCw, Search, ShieldAlert, Upload, UserPlus, Users, WalletCards, X } from 'lucide-react';

type AgentApplication = { id: string; applicationNo: string; fullName: string; region: string; promotionChannel: string; whatsappPhone: string; status: string; reviewNote: string; createdAt: string };
type Agent = { id: string; agentNo: string; name: string; displayPhone: string; referralCode: string; status: string; commissionRate: number | null; source: string; activatedAt: string; balance: { pending: number; available: number; paid: number } };
type Rule = { id: string; agentId: string | null; name: string; commissionRate: number; minOrderAmount: number; active: boolean; effectiveFrom: string };
type Payout = { id: string; payoutNo: string; agentId: string; agentNo: string; name: string; displayPhone: string; amount: number; paymentDetails: { bankName?: string; accountName?: string; accountNumber?: string }; status: string; requestedAt: string; reviewNote: string };
type Payload = { applications: AgentApplication[]; agents: Agent[]; rules: Rule[]; payouts: Payout[] };
type Tab = 'applications' | 'agents' | 'rules' | 'payouts';

interface AgentCenterProps {
  adminRole: string;
  onNotice: (message: string) => void;
}

const panel = 'rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]';
const input = 'h-11 rounded-xl border border-[#DDE2E8] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#C7A46A] focus:bg-white';

export function AgentCenter({ adminRole, onNotice }: AgentCenterProps) {
  const [data, setData] = useState<Payload>({ applications: [], agents: [], rules: [], payouts: [] });
  const [tab, setTab] = useState<Tab>('applications');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activationResult, setActivationResult] = useState<{ code: string; applicationNo: string; expiresAt: string } | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<any[]>([]);
  const [ruleForm, setRuleForm] = useState({ agentId: '', name: '默认代理佣金', rate: '5', minOrder: '0' });
  const canManageMoney = adminRole === 'admin' || adminRole === 'owner';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/agents');
      const payload = await readApiJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || '代理数据加载失败');
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '代理数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const action = async (body: Record<string, unknown>, message: string) => {
    setError('');
    try {
      const response = await fetch('/api/admin/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await readApiJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || '操作失败');
      onNotice(message);
      await load();
      return payload;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败');
      return null;
    }
  };

  const approve = async (application: AgentApplication) => {
    const note = window.prompt('审核备注（可留空）', '') ?? '';
    const payload = await action({ action: 'approve', applicationId: application.id, note }, '代理申请已通过');
    if (payload?.activationCode) setActivationResult({ code: payload.activationCode, applicationNo: payload.applicationNo, expiresAt: payload.expiresAt });
  };

  const review = async (application: AgentApplication, nextAction: 'reject' | 'request_changes') => {
    const note = window.prompt(nextAction === 'reject' ? '请输入拒绝原因' : '请输入需要补充的资料');
    if (!note) return;
    await action({ action: nextAction, applicationId: application.id, note }, nextAction === 'reject' ? '申请已拒绝' : '已要求补充资料');
  };

  const submitBulk = async () => {
    const entries = bulkText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [phone, name, commissionRate] = line.split(',').map(value => value.trim());
      return { phone, name, commissionRate: commissionRate || undefined };
    });
    const payload = await action({ action: 'bulk_create', entries }, '批量代理注册已执行');
    if (payload?.results) setBulkResult(payload.results);
  };

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return !keyword ? data.agents : data.agents.filter(agent => [agent.name, agent.displayPhone, agent.agentNo, agent.referralCode].some(value => value.toLowerCase().includes(keyword)));
  }, [data.agents, search]);

  const pendingApplications = data.applications.filter(row => row.status === 'pending' || row.status === 'changes_requested').length;
  const activeAgents = data.agents.filter(row => row.status === 'active').length;
  const pendingPayouts = data.payouts.filter(row => row.status === 'pending').length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary title="待审核申请" value={pendingApplications} icon={<ShieldAlert size={20} />} tone="amber" />
        <Summary title="有效代理" value={activeAgents} icon={<Users size={20} />} tone="green" />
        <Summary title="待处理提现" value={pendingPayouts} icon={<WalletCards size={20} />} tone="blue" />
      </div>

      <div className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex gap-2 overflow-x-auto">
            {([['applications', '申请审核'], ['agents', '代理管理'], ['rules', '佣金设置'], ['payouts', '提现审核']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-4 py-2 text-xs font-bold ${tab === id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}
          </div>
          <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新</button>
        </div>
        {error && <div role="alert" className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}

        {tab === 'applications' && <div className="divide-y divide-slate-100">{data.applications.length ? data.applications.map(application => <div key={application.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{application.fullName}</h3><Status value={application.status} /></div><p className="mt-1 text-xs text-slate-500">{application.whatsappPhone} · {application.region} · {application.promotionChannel}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{application.applicationNo} · {new Date(application.createdAt).toLocaleString()}</p>{application.reviewNote && <p className="mt-2 text-xs text-amber-700">审核说明：{application.reviewNote}</p>}</div><div className="flex flex-wrap gap-2">{['pending', 'changes_requested'].includes(application.status) && <><button type="button" onClick={() => approve(application)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">通过并生成代理码</button><button type="button" onClick={() => review(application, 'request_changes')} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">补充资料</button><button type="button" onClick={() => review(application, 'reject')} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">拒绝</button></>}{application.status === 'approved' && <button type="button" onClick={() => approve(application)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">重新生成代理码</button>}</div></div>) : <Empty text="暂无代理申请" />}</div>}

        {tab === 'agents' && <div className="p-4"><div className="grid gap-4 xl:grid-cols-[360px_1fr]"><div className="space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2"><UserPlus size={18} /><h3 className="font-bold">手机号批量注册代理</h3></div><p className="mt-2 text-xs leading-5 text-slate-500">每行：手机号,姓名,佣金比例。姓名和比例可留空，最多200行。</p><textarea value={bulkText} onChange={event => setBulkText(event.target.value)} rows={8} placeholder={'0123456789,张三,5\n60123456789,李四'} className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs outline-none focus:border-[#C7A46A]" />{canManageMoney ? <button type="button" onClick={submitBulk} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-bold text-white"><Upload size={15} />执行批量注册</button> : <p className="mt-3 text-xs text-amber-700">仅老板或管理员可批量注册代理。</p>}{bulkResult.length > 0 && <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white p-2">{bulkResult.map((row, index) => <p key={`${row.phone}-${index}`} className={`px-2 py-1 text-xs ${row.success ? 'text-emerald-700' : 'text-red-600'}`}>{row.phone}：{row.success ? `${row.agentNo} / ${row.referralCode}` : row.error}</p>)}</div>}</div></div><div><div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索姓名、手机号、代理编号、推广码" className={`${input} w-full pl-10`} /></div><div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">代理</th><th className="px-4 py-3">推广码</th><th className="px-4 py-3">佣金</th><th className="px-4 py-3">余额</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">操作</th></tr></thead><tbody>{filteredAgents.map(agent => <tr key={agent.id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-bold">{agent.name || agent.agentNo}</p><p className="text-xs text-slate-400">{agent.displayPhone} · {agent.agentNo}</p></td><td className="px-4 py-3 font-mono text-xs">{agent.referralCode}</td><td className="px-4 py-3">{agent.commissionRate == null ? '默认' : `${agent.commissionRate}%`}</td><td className="px-4 py-3"><p className="font-bold text-emerald-700">RM {agent.balance.available.toFixed(2)}</p><p className="text-[11px] text-slate-400">待确认 {agent.balance.pending.toFixed(2)}</p></td><td className="px-4 py-3"><Status value={agent.status} /></td><td className="px-4 py-3"><div className="flex gap-1"><button type="button" onClick={async () => { const amount = window.prompt('输入调整金额，可使用负数冲正'); const note = amount ? window.prompt('输入调整原因') : ''; if (amount && note) await action({ action: 'adjust_commission', agentId: agent.id, amount, note }, '佣金已调整'); }} disabled={!canManageMoney} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 disabled:opacity-40">调账</button><button type="button" onClick={async () => { const next = agent.status === 'active' ? 'suspended' : 'active'; const note = next === 'suspended' ? window.prompt('请输入暂停原因') : ''; if (next === 'active' || note) await action({ action: 'set_status', agentId: agent.id, status: next, note }, '代理状态已更新'); }} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{agent.status === 'active' ? '暂停' : '启用'}</button></div></td></tr>)}</tbody></table></div></div></div></div>}

        {tab === 'rules' && <div className="grid gap-4 p-4 lg:grid-cols-[380px_1fr]"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-bold">新增佣金规则</h3><div className="mt-4 grid gap-3"><select value={ruleForm.agentId} onChange={event => setRuleForm(current => ({ ...current, agentId: event.target.value }))} className={input}><option value="">所有代理默认规则</option>{data.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.agentNo} · {agent.name}</option>)}</select><input value={ruleForm.name} onChange={event => setRuleForm(current => ({ ...current, name: event.target.value }))} placeholder="规则名称" className={input} /><div className="grid grid-cols-2 gap-2"><input value={ruleForm.rate} onChange={event => setRuleForm(current => ({ ...current, rate: event.target.value }))} inputMode="decimal" placeholder="佣金 %" className={input} /><input value={ruleForm.minOrder} onChange={event => setRuleForm(current => ({ ...current, minOrder: event.target.value }))} inputMode="decimal" placeholder="最低订单" className={input} /></div><button type="button" disabled={!canManageMoney} onClick={() => action({ action: 'save_rule', agentId: ruleForm.agentId || undefined, name: ruleForm.name, commissionRate: ruleForm.rate, minOrderAmount: ruleForm.minOrder }, '佣金规则已保存')} className="rounded-xl bg-slate-950 py-3 text-xs font-bold text-white disabled:opacity-40">保存并立即生效</button></div></div><div className="overflow-hidden rounded-2xl border border-slate-100">{data.rules.length ? data.rules.map(rule => <div key={rule.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0"><div><p className="font-bold">{rule.name}</p><p className="mt-1 text-xs text-slate-400">{rule.agentId ? data.agents.find(agent => agent.id === rule.agentId)?.agentNo || '指定代理' : '默认规则'} · 最低订单 RM {rule.minOrderAmount.toFixed(2)}</p></div><div className="text-right"><p className="text-xl font-black text-[#A78345]">{rule.commissionRate}%</p><p className="text-[11px] text-slate-400">{rule.active ? '生效中' : '历史规则'}</p></div></div>) : <Empty text="暂无佣金规则，订单暂不产生佣金" />}</div></div>}

        {tab === 'payouts' && <div className="divide-y divide-slate-100">{data.payouts.length ? data.payouts.map(payout => <div key={payout.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-2"><h3 className="font-bold">{payout.name || payout.agentNo}</h3><Status value={payout.status} /></div><p className="mt-1 text-xs text-slate-500">{payout.displayPhone} · {payout.payoutNo}</p><p className="mt-2 text-2xl font-black text-slate-950">RM {payout.amount.toFixed(2)}</p><div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{payout.paymentDetails?.bankName || '-'} · {payout.paymentDetails?.accountName || '-'} · <span className="font-mono">{payout.paymentDetails?.accountNumber || '-'}</span></div></div>{canManageMoney && ['pending', 'approved'].includes(payout.status) && <div className="flex gap-2">{payout.status === 'pending' && <button type="button" onClick={() => action({ action: 'review_payout', payoutId: payout.id, payoutStatus: 'approved' }, '提现已批准')} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">批准</button>}<button type="button" onClick={() => action({ action: 'review_payout', payoutId: payout.id, payoutStatus: 'paid' }, '提现已标记付款')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">确认已付款</button><button type="button" onClick={async () => { const note = window.prompt('请输入拒绝原因'); if (note) await action({ action: 'review_payout', payoutId: payout.id, payoutStatus: 'rejected', note }, '提现已拒绝'); }} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">拒绝</button></div>}</div>) : <Empty text="暂无提现申请" />}</div>}
      </div>

      {activationResult && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold">一次性代理码</h3><p className="mt-1 text-xs text-red-600">只显示一次，请立即安全发送给申请人。</p></div><button type="button" onClick={() => setActivationResult(null)} aria-label="关闭"><X size={20} /></button></div><div className="mt-5 rounded-2xl bg-slate-950 p-5 text-center"><p className="font-mono text-3xl font-black tracking-[0.3em] text-white">{activationResult.code}</p></div><p className="mt-3 text-xs text-slate-500">申请编号：{activationResult.applicationNo}<br />有效期至：{new Date(activationResult.expiresAt).toLocaleString()}</p><button type="button" onClick={async () => { await navigator.clipboard.writeText(activationResult.code); onNotice('代理码已复制'); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C7A46A] py-3 text-sm font-bold text-white"><Copy size={16} />复制代理码</button></div></div>}
    </section>
  );
}

function Summary({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: 'amber' | 'green' | 'blue' }) {
  const colors = { amber: 'bg-amber-50 text-amber-700', green: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700' };
  return <div className={`${panel} flex items-center gap-4 p-5`}><div className={`grid h-11 w-11 place-items-center rounded-2xl ${colors[tone]}`}>{icon}</div><div><p className="text-xs font-bold text-slate-400">{title}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div></div>;
}

function Status({ value }: { value: string }) {
  const good = ['active', 'approved', 'activated', 'paid'].includes(value);
  const bad = ['rejected', 'terminated', 'voided'].includes(value);
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{labelStatus(value)}</span>;
}

function Empty({ text }: { text: string }) { return <div className="p-12 text-center text-sm text-slate-400">{text}</div>; }
function labelStatus(value: string) { return ({ pending: '待处理', changes_requested: '补充资料', approved: '已通过', rejected: '已拒绝', activated: '已激活', active: '正常', suspended: '已暂停', terminated: '已终止', paid: '已付款' } as Record<string, string>)[value] || value; }

async function readApiJson(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error(`代理 API 返回了非 JSON 响应（HTTP ${response.status}），请确认服务已更新并重启`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`代理 API 返回了无效 JSON（HTTP ${response.status}）`);
  }
}
