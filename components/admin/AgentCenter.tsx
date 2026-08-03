import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Copy, Plus, Search, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { AdminTabs } from './AdminTabs';

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
  const [modal, setModal] = useState<'single' | 'bulk' | 'rule' | null>(null);
  const [singleForm, setSingleForm] = useState({ phone: '', name: '', commissionRate: '' });
  const [ruleForm, setRuleForm] = useState({ agentId: '', name: '默认代理佣金', rate: '10', minOrder: '0' });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const canManageMoney = adminRole === 'admin';

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

  const submitSingle = async () => {
    const payload = await action({ action: 'bulk_create', entries: [singleForm] }, '代理已新增');
    if (payload?.results?.[0]?.success) {
      setSingleForm({ phone: '', name: '', commissionRate: '' });
      setModal(null);
    }
  };

  const saveRule = async () => {
    const payload = await action({ action: 'save_rule', agentId: ruleForm.agentId || undefined, name: ruleForm.name, commissionRate: ruleForm.rate, minOrderAmount: ruleForm.minOrder }, editingRuleId ? '佣金规则已更新' : '佣金规则已保存');
    if (payload) {
      setEditingRuleId(null);
      setModal(null);
    }
  };

  const openNewRule = () => {
    setEditingRuleId(null);
    setRuleForm({ agentId: '', name: '默认代理佣金', rate: '10', minOrder: '0' });
    setModal('rule');
  };

  const openEditRule = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setRuleForm({ agentId: rule.agentId || '', name: rule.name, rate: String(rule.commissionRate), minOrder: String(rule.minOrderAmount) });
    setModal('rule');
  };

  const deleteRule = async (rule: Rule) => {
    if (!window.confirm(`确定删除佣金规则「${rule.name}」吗？${rule.active ? '\n\n删除生效中的规则后，对应代理将改用其他可用规则。' : ''}`)) return;
    await action({ action: 'delete_rule', ruleId: rule.id }, '佣金规则已删除');
  };

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return !keyword ? data.agents : data.agents.filter(agent => [agent.name, agent.displayPhone, agent.agentNo, agent.referralCode].some(value => value.toLowerCase().includes(keyword)));
  }, [data.agents, search]);

  const pendingApplications = data.applications.filter(row => row.status === 'pending' || row.status === 'changes_requested').length;
  const activeAgents = data.agents.filter(row => row.status === 'active').length;
  const pendingPayouts = data.payouts.filter(row => row.status === 'pending').length;
  const activeRules = data.rules.filter(rule => rule.active);
  const defaultRule = activeRules.find(rule => !rule.agentId);
  const agentRate = (agent: Agent) => agent.commissionRate ?? activeRules.find(rule => rule.agentId === agent.id)?.commissionRate ?? defaultRule?.commissionRate ?? null;

  return (
    <section className="space-y-4">
      <AdminTabs label="代理中心页面" value={tab} onChange={setTab} items={[{ id: 'applications', label: '申请审核', count: pendingApplications }, { id: 'agents', label: '代理管理', count: activeAgents }, { id: 'rules', label: '佣金设置', count: activeRules.length }, { id: 'payouts', label: '提现审核', count: pendingPayouts }]} />

      {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}

      <div className={`${panel} overflow-hidden`}>
        {tab === 'applications' && <div className="divide-y divide-slate-100">{data.applications.length ? data.applications.map(application => <div key={application.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{application.fullName}</h3><Status value={application.status} /></div><p className="mt-1 text-xs text-slate-500">{application.whatsappPhone} · {application.region} · {application.promotionChannel}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{application.applicationNo} · {new Date(application.createdAt).toLocaleString()}</p>{application.reviewNote && <p className="mt-2 text-xs text-amber-700">审核说明：{application.reviewNote}</p>}</div><div className="flex flex-wrap gap-2">{['pending', 'changes_requested'].includes(application.status) && <><button type="button" onClick={() => approve(application)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">通过并生成代理码</button><button type="button" onClick={() => review(application, 'request_changes')} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">补充资料</button><button type="button" onClick={() => review(application, 'reject')} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">拒绝</button></>}{application.status === 'approved' && <button type="button" onClick={() => approve(application)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">重新生成代理码</button>}</div></div>) : <Empty text="暂无代理申请" />}</div>}

        {tab === 'agents' && <div className="p-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-lg font-black text-slate-950">代理列表</h2><p className="mt-1 text-xs text-slate-500">统一查看代理身份、佣金、余额和状态</p></div>
            <div className="flex flex-wrap gap-2">{canManageMoney && <><button type="button" onClick={() => setModal('single')} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"><UserPlus size={15} />新增代理</button><button type="button" onClick={() => { setBulkResult([]); setModal('bulk'); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"><Upload size={15} />批量导入</button></>}</div>
          </div>
          <div className="relative my-4 max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索姓名、手机号、代理编号或推广码" className={`${input} w-full pl-10`} /></div>
          <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">代理</th><th className="px-4 py-3">推广码</th><th className="px-4 py-3">佣金规则</th><th className="px-4 py-3">佣金余额</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">操作</th></tr></thead><tbody>{filteredAgents.map(agent => <tr key={agent.id} className="border-t border-slate-100"><td className="px-4 py-4"><p className="font-bold">{agent.name || agent.agentNo}</p><p className="text-xs text-slate-400">{agent.displayPhone} · {agent.agentNo}</p></td><td className="px-4 py-4 font-mono text-xs">{agent.referralCode}</td><td className="px-4 py-4"><p className="font-bold text-slate-800">{agentRate(agent) == null ? '未设置' : `${agentRate(agent)}%`}</p><p className="text-[11px] text-slate-400">{agent.commissionRate == null ? '继承规则' : '代理专属比例'}</p></td><td className="px-4 py-4"><p className="font-bold text-emerald-700">RM {agent.balance.available.toFixed(2)}</p><p className="text-[11px] text-slate-400">待确认 RM {agent.balance.pending.toFixed(2)}</p></td><td className="px-4 py-4"><Status value={agent.status} /></td><td className="px-4 py-4"><div className="flex flex-wrap gap-1"><button type="button" onClick={async () => { const amount = window.prompt('输入调整金额，可使用负数冲正'); const note = amount ? window.prompt('输入调整原因') : ''; if (amount && note) await action({ action: 'adjust_commission', agentId: agent.id, amount, note }, '佣金已调整'); }} disabled={!canManageMoney} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 disabled:opacity-40">调账</button><button type="button" onClick={async () => { const next = agent.status === 'active' ? 'suspended' : 'active'; const note = next === 'suspended' ? window.prompt('请输入暂停原因') : ''; if (next === 'active' || note) await action({ action: 'set_status', agentId: agent.id, status: next, note }, '代理状态已更新'); }} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{agent.status === 'active' ? '暂停' : '启用'}</button>{canManageMoney && <button type="button" onClick={async () => { if (!window.confirm(`确定删除代理「${agent.name || agent.agentNo}」吗？\n\n仅无订单归因、佣金流水和提现记录的代理可以删除。此操作会清除其推广绑定、代理申请和激活码，但保留普通用户账号。`)) return; await action({ action: 'delete_agent', agentId: agent.id }, '代理已删除'); }} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600"><Trash2 size={12} />删除</button>}</div></td></tr>)}</tbody></table>{filteredAgents.length === 0 && <Empty text="暂无符合条件的代理" />}</div>
        </div>}

        {tab === 'rules' && <div className="p-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">佣金规则</h2><p className="mt-1 text-xs text-slate-500">默认规则适用于所有代理，指定代理规则优先生效</p></div>{canManageMoney && data.rules.length > 0 && <button type="button" onClick={openNewRule} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"><Plus size={15} />新增佣金规则</button>}</div>
          {data.rules.length ? <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">规则名称</th><th className="px-4 py-3">适用范围</th><th className="px-4 py-3">佣金比例</th><th className="px-4 py-3">最低订单金额</th><th className="px-4 py-3">生效时间</th><th className="px-4 py-3">状态</th>{canManageMoney && <th className="px-4 py-3 text-right">操作</th>}</tr></thead><tbody>{data.rules.map(rule => <tr key={rule.id} className="border-t border-slate-100"><td className="px-4 py-4 font-bold text-slate-900">{rule.name}</td><td className="px-4 py-4">{rule.agentId ? data.agents.find(agent => agent.id === rule.agentId)?.agentNo || '指定代理' : '所有代理'}</td><td className="px-4 py-4 text-lg font-black text-[#A78345]">{rule.commissionRate}%</td><td className="px-4 py-4">{rule.minOrderAmount > 0 ? `RM ${rule.minOrderAmount.toFixed(2)}` : '不设门槛'}</td><td className="px-4 py-4 text-xs text-slate-500">{new Date(rule.effectiveFrom).toLocaleString()}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rule.active ? '生效中' : '历史规则'}</span></td>{canManageMoney && <td className="px-4 py-4"><div className="flex justify-end gap-2">{rule.active && <button type="button" onClick={() => openEditRule(rule)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">修改</button>}<button type="button" onClick={() => deleteRule(rule)} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">删除</button></div></td>}</tr>)}</tbody></table></div> : <div className="flex flex-col items-center px-6 py-12 text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#C7A46A]/15 text-[#A78345]"><BadgePercent size={26} /></div><h3 className="mt-4 text-base font-black text-slate-900">还没有佣金规则</h3><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">先建立一条默认规则，代理订单才会开始计算佣金。默认佣金比例为 10%。</p>{canManageMoney && <button type="button" onClick={openNewRule} className="mt-5 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"><Plus size={15} />创建默认佣金规则</button>}</div>}
        </div>}

        {tab === 'payouts' && <div className="divide-y divide-slate-100">{data.payouts.length ? data.payouts.map(payout => <div key={payout.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-2"><h3 className="font-bold">{payout.name || payout.agentNo}</h3><Status value={payout.status} /></div><p className="mt-1 text-xs text-slate-500">{payout.displayPhone} · {payout.payoutNo}</p><p className="mt-2 text-2xl font-black text-slate-950">RM {payout.amount.toFixed(2)}</p><div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{payout.paymentDetails?.bankName || '-'} · {payout.paymentDetails?.accountName || '-'} · <span className="font-mono">{payout.paymentDetails?.accountNumber || '-'}</span></div></div>{canManageMoney && ['pending', 'approved'].includes(payout.status) && <div className="flex gap-2">{payout.status === 'pending' && <button type="button" onClick={() => action({ action: 'review_payout', payoutId: payout.id, payoutStatus: 'approved' }, '提现已批准')} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">批准</button>}<button type="button" onClick={() => action({ action: 'review_payout', payoutId: payout.id, payoutStatus: 'paid' }, '提现已标记付款')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">确认已付款</button><button type="button" onClick={async () => { const note = window.prompt('请输入拒绝原因'); if (note) await action({ action: 'review_payout', payoutId: payout.id, payoutStatus: 'rejected', note }, '提现已拒绝'); }} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">拒绝</button></div>}</div>) : <Empty text="暂无提现申请" />}</div>}
      </div>

      {modal === 'single' && <Modal title="新增代理" onClose={() => setModal(null)}><div className="grid gap-4"><Field label="手机号"><input value={singleForm.phone} onChange={event => setSingleForm(current => ({ ...current, phone: event.target.value }))} placeholder="例如：0123456789" className={`${input} w-full`} /></Field><Field label="姓名（可留空）"><input value={singleForm.name} onChange={event => setSingleForm(current => ({ ...current, name: event.target.value }))} className={`${input} w-full`} /></Field><Field label="专属佣金比例（可留空）"><div className="relative"><input value={singleForm.commissionRate} onChange={event => setSingleForm(current => ({ ...current, commissionRate: event.target.value }))} inputMode="decimal" placeholder="留空则继承佣金规则" className={`${input} w-full pr-10`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></Field><button type="button" onClick={submitSingle} className="rounded-xl bg-slate-950 py-3 text-sm font-bold text-white">确认新增</button></div></Modal>}

      {modal === 'bulk' && <Modal title="批量导入代理" onClose={() => setModal(null)}><p className="text-xs leading-5 text-slate-500">每行填写：手机号, 姓名, 佣金比例。姓名和比例可留空，最多 200 行。</p><textarea value={bulkText} onChange={event => setBulkText(event.target.value)} rows={9} placeholder={'0123456789,张三,10\n60123456789,李四'} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm outline-none focus:border-[#C7A46A]" />{bulkResult.length > 0 && <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-slate-200 p-2">{bulkResult.map((row, index) => <p key={`${row.phone}-${index}`} className={`px-2 py-1 text-xs ${row.success ? 'text-emerald-700' : 'text-red-600'}`}>{row.phone}：{row.success ? `${row.agentNo} / ${row.referralCode}` : row.error}</p>)}</div>}<button type="button" onClick={submitBulk} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-bold text-white"><Upload size={16} />执行批量导入</button></Modal>}

      {modal === 'rule' && <Modal title={editingRuleId ? '修改佣金规则' : '新增佣金规则'} onClose={() => { setEditingRuleId(null); setModal(null); }}><div className="grid gap-4"><Field label="适用范围"><select value={ruleForm.agentId} onChange={event => setRuleForm(current => ({ ...current, agentId: event.target.value }))} className={`${input} w-full`}><option value="">所有代理默认规则</option>{data.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.agentNo} · {agent.name}</option>)}</select></Field><Field label="规则名称"><input value={ruleForm.name} onChange={event => setRuleForm(current => ({ ...current, name: event.target.value }))} className={`${input} w-full`} /></Field><Field label="佣金比例（%）"><input value={ruleForm.rate} onChange={event => setRuleForm(current => ({ ...current, rate: event.target.value }))} inputMode="decimal" className={`${input} w-full`} /></Field><Field label="最低订单金额（RM）"><input value={ruleForm.minOrder} onChange={event => setRuleForm(current => ({ ...current, minOrder: event.target.value }))} inputMode="decimal" className={`${input} w-full`} /></Field><p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">佣金比例 {ruleForm.rate || 0}% 表示按符合条件的订单金额计算 {ruleForm.rate || 0}% 佣金；最低订单金额 RM {ruleForm.minOrder || 0}。{editingRuleId ? '保存后原规则会保留为历史记录。' : ''}</p><button type="button" onClick={saveRule} className="rounded-xl bg-slate-950 py-3 text-sm font-bold text-white">{editingRuleId ? '保存修改并立即生效' : '保存并立即生效'}</button></div></Modal>}

      {activationResult && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold">一次性代理码</h3><p className="mt-1 text-xs text-red-600">只显示一次，请立即安全发送给申请人。</p></div><button type="button" onClick={() => setActivationResult(null)} aria-label="关闭"><X size={20} /></button></div><div className="mt-5 rounded-2xl bg-slate-950 p-5 text-center"><p className="font-mono text-3xl font-black tracking-[0.3em] text-white">{activationResult.code}</p></div><p className="mt-3 text-xs text-slate-500">申请编号：{activationResult.applicationNo}<br />有效期至：{new Date(activationResult.expiresAt).toLocaleString()}</p><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold text-slate-500">发送给申请人的通知文案</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-slate-700">{buildActivationMessage(activationResult)}</pre></div><button type="button" onClick={async () => { await navigator.clipboard.writeText(buildActivationMessage(activationResult)); onNotice('代理通知文案已复制'); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C7A46A] py-3 text-sm font-bold text-white"><Copy size={16} />复制通知文案</button></div></div>}
    </section>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-black text-slate-950">{title}</h3><button type="button" onClick={onClose} aria-label="关闭" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-950"><X size={18} /></button></div>{children}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-slate-600"><span>{label}</span>{children}</label>;
}

function Status({ value }: { value: string }) {
  const good = ['active', 'approved', 'activated', 'paid'].includes(value);
  const bad = ['rejected', 'terminated', 'voided'].includes(value);
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{labelStatus(value)}</span>;
}

function Empty({ text }: { text: string }) { return <div className="p-12 text-center text-sm text-slate-400">{text}</div>; }
function labelStatus(value: string) { return ({ pending: '待处理', changes_requested: '补充资料', approved: '已通过', rejected: '已拒绝', activated: '已激活', active: '正常', suspended: '已暂停', terminated: '已终止', paid: '已付款' } as Record<string, string>)[value] || value; }
function buildActivationMessage(result: { code: string; applicationNo: string; expiresAt: string }) {
  return `您好，您的代理申请已审核通过。\n\n一次性代理码：${result.code}\n有效期至：${new Date(result.expiresAt).toLocaleString()}\n\n请返回网站「个人中心 → 代理合作」，输入代理码完成激活。`;
}

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
