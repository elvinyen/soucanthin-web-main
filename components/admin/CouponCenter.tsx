import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Plus,
  RefreshCw,
  Search,
  Send,
  TicketPercent,
  Users,
  X,
} from 'lucide-react';

type AdminRole = 'admin' | 'owner' | 'manager' | 'staff' | 'kitchen' | 'customer_service' | 'delivery';
type CouponTab = 'campaigns' | 'issue' | 'records' | 'analytics';
type CouponStatus = 'draft' | 'active' | 'paused' | 'ended';

type Campaign = {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  validityDays?: number | null;
  totalIssueLimit?: number | null;
  perUserLimit: number;
  applicableOrderTypes: string[];
  applicablePaymentMethods: string[];
  applicableBranchIds: string[];
  excludeDeliveryFee: boolean;
  status: CouponStatus;
  issued: number;
  used: number;
  reserved: number;
  createdAt: string;
};

type CouponRecord = {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  couponTitle: string;
  couponCode: string;
  status: 'available' | 'reserved' | 'used' | 'expired' | 'revoked';
  source: string;
  expiresAt?: string | null;
  issuedAt?: string | null;
  reservedAt?: string | null;
  usedAt?: string | null;
  orderNo: string;
  revokeReason: string;
};

type CouponPayload = {
  success: true;
  campaigns: Campaign[];
  records: CouponRecord[];
  summary: {
    activeCampaigns: number;
    issued: number;
    used: number;
    reserved: number;
    redemptionRate: number;
    discountCost: number;
    sales: number;
    averageOrder: number;
  };
};

type Customer = { id: string; name: string; phone: string; displayPhone: string };
type Branch = { id: string; name: string; active: boolean };

type CampaignForm = {
  code: string;
  title: string;
  description: string;
  discountType: 'fixed' | 'percentage';
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  validFrom: string;
  validUntil: string;
  validityDays: string;
  totalIssueLimit: string;
  perUserLimit: string;
  applicableOrderTypes: string[];
  applicablePaymentMethods: string[];
  applicableBranchIds: string[];
  excludeDeliveryFee: boolean;
  status: 'draft' | 'active';
};

type Props = {
  api: <T,>(path: string, init?: RequestInit) => Promise<T>;
  admin: { role: AdminRole };
  onNotice?: (message: string) => void;
};

const emptyPayload: CouponPayload = {
  success: true,
  campaigns: [],
  records: [],
  summary: { activeCampaigns: 0, issued: 0, used: 0, reserved: 0, redemptionRate: 0, discountCost: 0, sales: 0, averageOrder: 0 },
};

const emptyForm: CampaignForm = {
  code: '',
  title: '',
  description: '',
  discountType: 'fixed',
  discountValue: '10',
  minOrderAmount: '30',
  maxDiscountAmount: '',
  validFrom: '',
  validUntil: '',
  validityDays: '14',
  totalIssueLimit: '',
  perUserLimit: '1',
  applicableOrderTypes: ['dinein', 'takeaway'],
  applicablePaymentMethods: ['cash', 'tng', 'stripe', 'wallet'],
  applicableBranchIds: [],
  excludeDeliveryFee: true,
  status: 'draft',
};

export function CouponCenter({ api, admin, onNotice }: Props) {
  const apiRef = useRef(api);
  const [tab, setTab] = useState<CouponTab>('campaigns');
  const [payload, setPayload] = useState<CouponPayload>(emptyPayload);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [campaignStatus, setCampaignStatus] = useState<'all' | CouponStatus>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [issueCampaignId, setIssueCampaignId] = useState('');
  const [issueReason, setIssueReason] = useState('营销活动发放');
  const canManageCampaigns = admin.role === 'admin' || admin.role === 'owner';

  useEffect(() => { apiRef.current = api; }, [api]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [next, branchPayload] = await Promise.all([
        apiRef.current<CouponPayload>('/api/admin/coupons'),
        apiRef.current<{ branches?: Branch[] }>('/api/admin/store-branches').catch(() => ({ branches: [] })),
      ]);
      setPayload(next);
      setBranches((branchPayload.branches || []).filter(branch => branch.active));
      if (!issueCampaignId) setIssueCampaignId(next.campaigns.find(campaign => campaign.status === 'active')?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '优惠券数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [issueCampaignId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredCampaigns = useMemo(() => payload.campaigns.filter(campaign => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || campaign.title.toLowerCase().includes(query) || campaign.code.toLowerCase().includes(query);
    const matchesStatus = campaignStatus === 'all' || campaign.status === campaignStatus;
    return matchesSearch && matchesStatus;
  }), [payload.campaigns, search, campaignStatus]);

  const searchCustomers = async () => {
    setError('');
    try {
      const next = await apiRef.current<{ customers: Customer[] }>(`/api/admin/customers?search=${encodeURIComponent(customerSearch)}`);
      setCustomers(next.customers || []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '用户查询失败');
    }
  };

  const saveCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRef.current('/api/admin/coupons', { method: 'POST', body: JSON.stringify({ action: 'create', ...form }) });
      setEditorOpen(false);
      setForm(emptyForm);
      onNotice?.(form.status === 'active' ? '优惠券已创建并上线' : '优惠券草稿已保存');
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '优惠券保存失败');
    } finally {
      setSaving(false);
    }
  };

  const changeCampaignStatus = async (campaign: Campaign, status: CouponStatus) => {
    setError('');
    try {
      await apiRef.current('/api/admin/coupons', { method: 'PATCH', body: JSON.stringify({ id: campaign.id, status }) });
      onNotice?.(status === 'active' ? '活动已上线' : status === 'paused' ? '活动已暂停' : '活动已结束');
      await loadData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : '活动状态更新失败');
    }
  };

  const issueCoupons = async () => {
    if (!issueCampaignId || !selectedUsers.length) {
      setError('请选择优惠券和用户');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await apiRef.current<{ issued: number; skipped: number }>('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({ action: 'issue', couponId: issueCampaignId, userIds: selectedUsers, reason: issueReason }),
      });
      setSelectedUsers([]);
      onNotice?.(`已发放 ${result.issued} 张${result.skipped ? `，跳过 ${result.skipped} 位已达上限用户` : ''}`);
      await loadData();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : '优惠券发放失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Metric label="进行中" value={payload.summary.activeCampaigns} />
        <Metric label="已发放" value={payload.summary.issued} />
        <Metric label="已核销" value={payload.summary.used} tone="green" />
        <Metric label="核销率" value={`${payload.summary.redemptionRate.toFixed(1)}%`} tone="gold" />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {([
              ['campaigns', '优惠券活动', TicketPercent],
              ['issue', '发放优惠券', Send],
              ['records', '领取与核销', Users],
              ['analytics', '效果分析', BarChart3],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><Icon size={15} />{label}</button>
            ))}
          </div>
          <button type="button" onClick={() => void loadData()} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新</button>
        </div>

        {error && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        {tab === 'campaigns' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="grid shrink-0 gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索活动名称或券码" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#C7A46A] focus:bg-white" /></div>
              <select value={campaignStatus} onChange={event => setCampaignStatus(event.target.value as typeof campaignStatus)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"><option value="all">全部状态</option><option value="active">进行中</option><option value="draft">草稿</option><option value="paused">已暂停</option><option value="ended">已结束</option></select>
              {canManageCampaigns && <button type="button" onClick={() => setEditorOpen(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white"><Plus size={17} />新建优惠券</button>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3 text-left">活动</th><th className="px-4 py-3 text-left">优惠规则</th><th className="px-4 py-3 text-left">有效期</th><th className="px-4 py-3 text-center">发放 / 核销</th><th className="px-4 py-3 text-center">状态</th><th className="px-4 py-3 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCampaigns.map(campaign => (
                    <tr key={campaign.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><p className="font-bold text-slate-950">{campaign.title}</p><p className="mt-1 font-mono text-xs text-[#C7A46A]">{campaign.code}</p></td>
                      <td className="px-4 py-4 text-slate-600">{campaignRule(campaign)}</td>
                      <td className="px-4 py-4 text-slate-600">{campaign.validityDays ? `领取后 ${campaign.validityDays} 天` : formatRange(campaign.validFrom, campaign.validUntil)}</td>
                      <td className="px-4 py-4 text-center font-bold text-slate-700">{campaign.issued} / {campaign.used}</td>
                      <td className="px-4 py-4 text-center"><StatusBadge status={campaign.status} /></td>
                      <td className="px-4 py-4"><div className="flex justify-center gap-2">{canManageCampaigns && campaign.status !== 'ended' && (campaign.status === 'active' ? <button type="button" onClick={() => void changeCampaignStatus(campaign, 'paused')} className="rounded-lg border border-slate-200 p-2 text-slate-500" title="暂停"><CirclePause size={16} /></button> : <button type="button" onClick={() => void changeCampaignStatus(campaign, 'active')} className="rounded-lg border border-slate-200 p-2 text-emerald-600" title="上线"><CirclePlay size={16} /></button>)}<button type="button" onClick={() => { setIssueCampaignId(campaign.id); setTab('issue'); }} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">发券<ChevronRight size={14} /></button></div></td>
                    </tr>
                  ))}
                  {!filteredCampaigns.length && <tr><td colSpan={6} className="px-4 py-16 text-center text-sm font-bold text-slate-400">暂无优惠券活动</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'issue' && (
          <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="grid content-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Field label="选择优惠券"><select value={issueCampaignId} onChange={event => setIssueCampaignId(event.target.value)} className={inputClass}><option value="">请选择</option>{payload.campaigns.filter(campaign => campaign.status === 'active').map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title} · {campaignRule(campaign)}</option>)}</select></Field>
              <Field label="发放原因"><textarea value={issueReason} onChange={event => setIssueReason(event.target.value)} className={`${inputClass} min-h-24 py-3`} /></Field>
              <div className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-500">已选择 <strong className="text-slate-950">{selectedUsers.length}</strong> 位用户。系统会自动跳过超过每人限领或总发行量的记录。</div>
              <button type="button" disabled={saving || !selectedUsers.length || !issueCampaignId} onClick={() => void issueCoupons()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{saving ? '正在发放' : '确认发放'}</button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex gap-2 border-b border-slate-200 p-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && void searchCustomers()} placeholder="输入姓名或手机号" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none" /></div><button type="button" onClick={() => void searchCustomers()} className="rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700">查询</button></div>
              <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                {customers.map(customer => { const selected = selectedUsers.includes(customer.id); return <button key={customer.id} type="button" onClick={() => setSelectedUsers(current => selected ? current.filter(id => id !== customer.id) : [...current, customer.id])} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50"><span><span className="block text-sm font-bold text-slate-950">{customer.name || '未命名用户'}</span><span className="mt-1 block text-xs text-slate-500">{customer.displayPhone || customer.phone}</span></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 text-transparent'}`}><Check size={14} /></span></button>; })}
                {!customers.length && <div className="px-4 py-16 text-center text-sm font-bold text-slate-400">搜索用户后选择发放对象</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'records' && <RecordsTable records={payload.records} />}

        {tab === 'analytics' && (
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-auto p-4 md:grid-cols-3">
            <AnalysisCard label="优惠成本" value={`RM ${payload.summary.discountCost.toFixed(2)}`} description="已核销且未取消订单" />
            <AnalysisCard label="带动销售额" value={`RM ${payload.summary.sales.toFixed(2)}`} description="优惠订单实际应付金额" />
            <AnalysisCard label="优惠订单客单价" value={`RM ${payload.summary.averageOrder.toFixed(2)}`} description="用于衡量优惠带来的订单质量" />
          </div>
        )}
      </section>

      {editorOpen && <CampaignEditor form={form} setForm={setForm} branches={branches} saving={saving} onClose={() => setEditorOpen(false)} onSubmit={saveCampaign} />}
    </div>
  );
}

function CampaignEditor({ form, setForm, branches, saving, onClose, onSubmit }: {
  form: CampaignForm;
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>;
  branches: Branch[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const update = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const toggle = (key: 'applicableOrderTypes' | 'applicablePaymentMethods' | 'applicableBranchIds', value: string) => update(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value]);
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm"><form onSubmit={onSubmit} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C7A46A]">Marketing</p><h3 className="mt-1 text-xl font-bold text-slate-950">新建优惠券</h3></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X size={18} /></button></div><div className="grid flex-1 gap-5 overflow-y-auto p-5">
    <FormSection title="基本信息"><div className="grid gap-3 sm:grid-cols-2"><Field label="优惠券名称"><input required value={form.title} onChange={event => update('title', event.target.value)} className={inputClass} placeholder="新用户欢迎券" /></Field><Field label="券码"><input required value={form.code} onChange={event => update('code', event.target.value.toUpperCase())} className={inputClass} placeholder="NEWUSER10" /></Field></div><Field label="用户端说明"><textarea value={form.description} onChange={event => update('description', event.target.value)} className={`${inputClass} min-h-20 py-3`} placeholder="仅限首次下单使用" /></Field></FormSection>
    <FormSection title="优惠规则"><div className="grid gap-3 sm:grid-cols-3"><Field label="优惠类型"><select value={form.discountType} onChange={event => update('discountType', event.target.value as CampaignForm['discountType'])} className={inputClass}><option value="fixed">固定金额</option><option value="percentage">百分比折扣</option></select></Field><Field label={form.discountType === 'fixed' ? '减免金额 RM' : '折扣百分比'}><input required type="number" min="0.01" step="0.01" value={form.discountValue} onChange={event => update('discountValue', event.target.value)} className={inputClass} /></Field><Field label="最低消费 RM"><input type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={event => update('minOrderAmount', event.target.value)} className={inputClass} /></Field></div>{form.discountType === 'percentage' && <Field label="最高抵扣 RM"><input type="number" min="0.01" step="0.01" value={form.maxDiscountAmount} onChange={event => update('maxDiscountAmount', event.target.value)} className={inputClass} /></Field>}<label className="flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.excludeDeliveryFee} onChange={event => update('excludeDeliveryFee', event.target.checked)} />配送费不参与优惠</label></FormSection>
    <FormSection title="有效期与发行限制"><div className="grid gap-3 sm:grid-cols-2"><Field label="领取后有效天数"><input type="number" min="1" value={form.validityDays} onChange={event => update('validityDays', event.target.value)} className={inputClass} /></Field><Field label="活动截止时间"><input type="datetime-local" value={form.validUntil} onChange={event => update('validUntil', event.target.value)} className={inputClass} /></Field><Field label="总发行量（留空不限）"><input type="number" min="1" value={form.totalIssueLimit} onChange={event => update('totalIssueLimit', event.target.value)} className={inputClass} /></Field><Field label="每人限领"><input type="number" min="1" value={form.perUserLimit} onChange={event => update('perUserLimit', event.target.value)} className={inputClass} /></Field></div></FormSection>
    <FormSection title="适用范围"><CheckGroup label="订单类型" options={[['dinein', '堂食'], ['takeaway', '外卖']]} selected={form.applicableOrderTypes} onToggle={value => toggle('applicableOrderTypes', value)} /><CheckGroup label="支付方式" options={[['cash', '现金'], ['wallet', '钱包'], ['tng', 'TNG'], ['stripe', 'Stripe']]} selected={form.applicablePaymentMethods} onToggle={value => toggle('applicablePaymentMethods', value)} />{branches.length > 0 && <CheckGroup label="指定门店（不选表示全部）" options={branches.map(branch => [branch.id, branch.name])} selected={form.applicableBranchIds} onToggle={value => toggle('applicableBranchIds', value)} />}</FormSection>
    <FormSection title="发布"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => update('status', 'draft')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${form.status === 'draft' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 text-slate-600'}`}>保存草稿</button><button type="button" onClick={() => update('status', 'active')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${form.status === 'active' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600'}`}>立即上线</button></div></FormSection>
  </div><div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">取消</button><button type="submit" disabled={saving} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? '保存中' : form.status === 'active' ? '创建并上线' : '保存草稿'}</button></div></form></div>;
}

function RecordsTable({ records }: { records: CouponRecord[] }) {
  return <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[900px] border-collapse text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3 text-left">用户</th><th className="px-4 py-3 text-left">优惠券</th><th className="px-4 py-3 text-center">状态</th><th className="px-4 py-3 text-left">订单号</th><th className="px-4 py-3 text-left">发放时间</th><th className="px-4 py-3 text-left">核销/过期</th></tr></thead><tbody className="divide-y divide-slate-100">{records.map(record => <tr key={record.id}><td className="px-5 py-4"><p className="font-bold text-slate-950">{record.customerName}</p><p className="mt-1 text-xs text-slate-500">{record.phone}</p></td><td className="px-4 py-4"><p className="font-bold text-slate-700">{record.couponTitle}</p><p className="mt-1 font-mono text-xs text-[#C7A46A]">{record.couponCode}</p></td><td className="px-4 py-4 text-center"><RecordBadge status={record.status} /></td><td className="px-4 py-4 font-mono text-xs text-slate-600">{record.orderNo || '—'}</td><td className="px-4 py-4 text-slate-500">{formatDate(record.issuedAt)}</td><td className="px-4 py-4 text-slate-500">{record.usedAt ? formatDate(record.usedAt) : record.expiresAt ? formatDate(record.expiresAt) : '长期有效'}</td></tr>)}{!records.length && <tr><td colSpan={6} className="px-4 py-16 text-center text-sm font-bold text-slate-400">暂无发放记录</td></tr>}</tbody></table></div>;
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none focus:border-[#C7A46A] focus:bg-white';
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-xs font-bold text-slate-500">{label}{children}</label>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-2xl border border-slate-200 p-4"><h4 className="text-sm font-bold text-slate-950">{title}</h4>{children}</section>; }
function CheckGroup({ label, options, selected, onToggle }: { label: string; options: string[][]; selected: string[]; onToggle: (value: string) => void }) { return <div><p className="mb-2 text-xs font-bold text-slate-500">{label}</p><div className="flex flex-wrap gap-2">{options.map(([value, text]) => <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-full border px-3 py-2 text-xs font-bold ${selected.includes(value) ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{text}</button>)}</div></div>; }
function Metric({ label, value, tone = 'blue' }: { label: string; value: React.ReactNode; tone?: 'blue' | 'green' | 'gold' }) { const tones = { blue: 'border-blue-100 bg-blue-50 text-blue-700', green: 'border-emerald-100 bg-emerald-50 text-emerald-700', gold: 'border-amber-100 bg-amber-50 text-amber-700' }; return <div className={`min-w-[126px] rounded-2xl border px-4 py-3 ${tones[tone]}`}><p className="text-[11px] font-bold opacity-70">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function AnalysisCard({ label, value, description }: { label: string; value: string; description: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p></div>; }
function StatusBadge({ status }: { status: CouponStatus }) { const labels = { draft: '草稿', active: '进行中', paused: '已暂停', ended: '已结束' }; const tones = status === 'active' ? 'bg-emerald-50 text-emerald-700' : status === 'draft' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones}`}>{labels[status]}</span>; }
function RecordBadge({ status }: { status: CouponRecord['status'] }) { const labels = { available: '可使用', reserved: '锁定中', used: '已核销', expired: '已过期', revoked: '已撤销' }; const tones = status === 'used' ? 'bg-emerald-50 text-emerald-700' : status === 'reserved' ? 'bg-amber-50 text-amber-700' : status === 'available' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'; return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones}`}>{labels[status]}</span>; }
function campaignRule(campaign: Campaign) { const discount = campaign.discountType === 'fixed' ? `减 RM ${campaign.discountValue.toFixed(2)}` : `${campaign.discountValue}% 折扣${campaign.maxDiscountAmount ? `，最高减 RM ${campaign.maxDiscountAmount.toFixed(2)}` : ''}`; return `${campaign.minOrderAmount > 0 ? `满 RM ${campaign.minOrderAmount.toFixed(2)} ` : ''}${discount}`; }
function formatRange(from?: string | null, until?: string | null) { if (!from && !until) return '长期有效'; return `${from ? formatDate(from) : '立即'} – ${until ? formatDate(until) : '长期'}`; }
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-MY', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
