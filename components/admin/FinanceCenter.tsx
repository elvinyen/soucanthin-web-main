import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

type AdminRole = 'admin' | 'owner' | 'manager' | 'staff' | 'kitchen' | 'customer_service' | 'delivery';
type FinanceType = 'income' | 'expense';
type FinanceTab = 'today' | 'ledger' | 'analysis';

type FinanceTransaction = {
  id: string;
  source: 'manual' | 'order';
  branchId: string;
  branchName: string;
  type: FinanceType;
  categoryId: string;
  categoryName: string;
  amount: number;
  paymentMethod: string;
  occurredAt: string;
  vendorName: string;
  note: string;
  receiptUrl?: string | null;
  status: 'submitted' | 'approved' | 'voided';
  createdBy: string;
  createdByName: string;
};

type FinancePayload = {
  success: true;
  categories: { id: string; name: string; type: FinanceType; icon: string; color: string }[];
  branches: { id: string; name: string; active: boolean }[];
  transactions: FinanceTransaction[];
  summary: { income: number; expense: number; balance: number; orderCount: number; averageOrder: number; pendingCount: number };
  analytics: {
    daily: { date: string; income: number; expense: number }[];
    expenses: { name: string; amount: number }[];
    payments: { name: string; amount: number }[];
  };
};

type FinanceCenterProps = {
  api: <T,>(path: string, init?: RequestInit) => Promise<T>;
  admin: { role: AdminRole; assignedBranchId?: string | null };
  onNotice?: (message: string) => void;
};

type EntryForm = {
  type: FinanceType;
  branchId: string;
  categoryId: string;
  amount: string;
  paymentMethod: string;
  occurredAt: string;
  vendorName: string;
  note: string;
  receipt: File | null;
};

const emptyPayload: FinancePayload = {
  success: true,
  categories: [],
  branches: [],
  transactions: [],
  summary: { income: 0, expense: 0, balance: 0, orderCount: 0, averageOrder: 0, pendingCount: 0 },
  analytics: { daily: [], expenses: [], payments: [] },
};

const paymentLabels: Record<string, string> = {
  cash: '现金', tng: 'Touch ‘n Go', bank: '银行转账', card: '银行卡', stripe: 'Stripe', wallet: '会员钱包',
};

export function FinanceCenter({ api, admin, onNotice }: FinanceCenterProps) {
  const apiRef = useRef(api);
  const [tab, setTab] = useState<FinanceTab>('today');
  const [payload, setPayload] = useState<FinancePayload>(emptyPayload);
  const [branchId, setBranchId] = useState(admin.assignedBranchId || '');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinanceType>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<FinanceType>('expense');
  const [form, setForm] = useState<EntryForm>(() => createEntryForm('expense', admin.assignedBranchId || ''));
  const canChooseBranch = admin.role === 'admin' || admin.role === 'owner';
  const canManage = admin.role === 'admin' || admin.role === 'owner' || admin.role === 'manager';

  useEffect(() => { apiRef.current = api; }, [api]);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = dateRangeForTab(tab);
      const query = new URLSearchParams({ from: range.from, to: range.to });
      if (branchId) query.set('branchId', branchId);
      const next = await apiRef.current<FinancePayload>(`/api/admin/finance?${query.toString()}`);
      setPayload(next);
      if (!branchId && !canChooseBranch && next.branches[0]) setBranchId(next.branches[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '财务数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [branchId, canChooseBranch, tab]);

  useEffect(() => { void loadFinance(); }, [loadFinance]);

  const filteredTransactions = useMemo(() => payload.transactions.filter(transaction => {
    if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || [transaction.categoryName, transaction.vendorName, transaction.note, transaction.branchName, paymentLabels[transaction.paymentMethod]]
      .some(value => String(value || '').toLowerCase().includes(query));
  }), [payload.transactions, search, typeFilter]);

  const openEntry = (type: FinanceType) => {
    const defaultBranch = branchId || payload.branches[0]?.id || admin.assignedBranchId || '';
    setEntryType(type);
    setForm(createEntryForm(type, defaultBranch));
    setError('');
    setEntryOpen(true);
  };

  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const receipt = form.receipt ? await readReceipt(form.receipt) : null;
      await api('/api/admin/finance', {
        method: 'POST',
        body: JSON.stringify({
          branchId: form.branchId,
          type: entryType,
          categoryId: form.categoryId,
          amount: form.amount,
          paymentMethod: form.paymentMethod,
          occurredAt: new Date(form.occurredAt).toISOString(),
          vendorName: form.vendorName,
          note: form.note,
          receipt,
        }),
      });
      setEntryOpen(false);
      onNotice?.(entryType === 'expense' ? '开支已记录' : '额外收入已记录');
      await loadFinance();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (transaction: FinanceTransaction, action: 'approve' | 'void') => {
    const note = action === 'void' ? window.prompt('请输入冲销原因') : '';
    if (action === 'void' && !note) return;
    setError('');
    try {
      await api('/api/admin/finance', { method: 'PATCH', body: JSON.stringify({ id: transaction.id, action, note }) });
      onNotice?.(action === 'approve' ? '账目已审核' : '账目已冲销');
      await loadFinance();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-24 sm:space-y-5 sm:pb-8">
      <div className="flex flex-col gap-3 rounded-[20px] border border-[#E5E7EB] bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex overflow-x-auto rounded-[14px] bg-[#F1F5F9] p-1">
          {([
            ['today', '今日收支', CalendarDays],
            ['ledger', '收支明细', FileText],
            ['analysis', '经营分析', BarChart3],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition ${tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {canChooseBranch && (
            <label className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Store className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select value={branchId} onChange={event => setBranchId(event.target.value)} aria-label="选择门店" className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-500">
                <option value="">全部门店</option>
                {payload.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => void loadFinance()} disabled={loading} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-950 disabled:opacity-50" aria-label="刷新财务数据">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && !entryOpen && <ErrorNotice message={error} />}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryCard label="收入" value={payload.summary.income} icon={ArrowUpRight} tone="green" loading={loading} />
        <SummaryCard label="开支" value={payload.summary.expense} icon={ArrowDownRight} tone="red" loading={loading} />
        <SummaryCard label="经营结余" value={payload.summary.balance} icon={TrendingUp} tone={payload.summary.balance >= 0 ? 'blue' : 'red'} loading={loading} prominent />
        <SummaryCard label="有效订单" value={payload.summary.orderCount} icon={ReceiptText} tone="slate" loading={loading} currency={false} />
        <SummaryCard label="平均客单" value={payload.summary.averageOrder} icon={CircleDollarSign} tone="slate" loading={loading} className="col-span-2 xl:col-span-1" />
      </section>

      {tab === 'today' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
          <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div><h3 className="font-black text-slate-950">今日流水</h3><p className="mt-1 text-xs text-slate-500">订单收入自动汇总，手工账目单独标记</p></div>
              {payload.summary.pendingCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{payload.summary.pendingCount} 笔待审核</span>}
            </div>
            <TransactionList transactions={payload.transactions.slice(0, 12)} loading={loading} canManage={canManage} onAction={runAction} />
          </section>
          <aside className="space-y-3">
            <button type="button" onClick={() => openEntry('expense')} className="group flex w-full items-center gap-4 rounded-[20px] bg-slate-950 p-5 text-left text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><ArrowDownRight size={23} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-base">记录一笔开支</strong><small className="mt-1 block text-slate-300">采购、包装、水电或其他支出</small></span>
              <ChevronRight size={20} className="text-slate-400 transition group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={() => openEntry('income')} className="group flex w-full items-center gap-4 rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 text-left text-emerald-950 transition hover:-translate-y-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white"><Plus size={23} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-base">记录额外收入</strong><small className="mt-1 block text-emerald-700">只记录系统订单以外的收入</small></span>
              <ChevronRight size={20} className="text-emerald-500 transition group-hover:translate-x-1" />
            </button>
            <div className="rounded-[20px] border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <div className="flex items-start gap-3"><Landmark size={19} className="mt-0.5 shrink-0 text-blue-600" /><p><strong>订单无需重复记账。</strong><br />线上已付款订单及已完成现金订单会自动计入营业收入。</p></div>
            </div>
          </aside>
        </div>
      )}

      {tab === 'ledger' && (
        <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[minmax(220px,1fr)_170px_auto]">
            <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索分类、供应商或备注" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" /></label>
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500">
              <option value="all">全部收支</option><option value="income">只看收入</option><option value="expense">只看开支</option>
            </select>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => openEntry('expense')} className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">记开支</button><button type="button" onClick={() => openEntry('income')} className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">记收入</button></div>
          </div>
          <TransactionList transactions={filteredTransactions} loading={loading} canManage={canManage} onAction={runAction} full />
        </section>
      )}

      {tab === 'analysis' && <AnalysisPanel payload={payload} loading={loading} />}

      <div className="fixed bottom-4 left-4 right-4 z-20 grid grid-cols-2 gap-2 sm:hidden">
        <button type="button" onClick={() => openEntry('expense')} className="h-12 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-xl">+ 记录开支</button>
        <button type="button" onClick={() => openEntry('income')} className="h-12 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-xl">+ 额外收入</button>
      </div>

      {entryOpen && (
        <EntrySheet
          type={entryType}
          form={form}
          setForm={setForm}
          categories={payload.categories.filter(category => category.type === entryType)}
          branches={payload.branches}
          canChooseBranch={canChooseBranch}
          error={error}
          saving={saving}
          onClose={() => { setEntryOpen(false); setError(''); }}
          onSubmit={submitEntry}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone, loading, prominent = false, currency = true, className = '' }: { label: string; value: number; icon: React.ComponentType<{ size?: number }>; tone: 'green' | 'red' | 'blue' | 'slate'; loading: boolean; prominent?: boolean; currency?: boolean; className?: string }) {
  const tones = { green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', slate: 'bg-slate-100 text-slate-600' };
  return <article className={`min-w-0 rounded-[18px] border p-4 ${prominent ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-white' : 'border-[#E5E7EB] bg-white'} ${className}`}><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={16} /></span></div><p className={`mt-4 whitespace-nowrap font-black tracking-tight text-slate-950 ${prominent ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}>{loading ? '—' : currency ? formatMoney(value) : value.toLocaleString()}</p></article>;
}

function TransactionList({ transactions, loading, canManage, onAction, full = false }: { transactions: FinanceTransaction[]; loading: boolean; canManage: boolean; onAction: (transaction: FinanceTransaction, action: 'approve' | 'void') => void; full?: boolean }) {
  if (loading) return <div className="space-y-3 p-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  if (!transactions.length) return <div className="px-4 py-16 text-center"><ReceiptText className="mx-auto text-slate-300" size={34} /><p className="mt-3 text-sm font-bold text-slate-400">当前范围还没有收支记录</p></div>;
  return <div className={full ? 'max-h-[calc(100vh-300px)] overflow-auto' : ''}>{transactions.map(transaction => <div key={`${transaction.source}-${transaction.id}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 sm:px-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{transaction.type === 'income' ? <ArrowUpRight size={19} /> : <ArrowDownRight size={19} />}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-slate-950">{transaction.categoryName}</p>{transaction.source === 'order' && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">自动</span>}{transaction.status === 'submitted' && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">待审核</span>}{transaction.status === 'voided' && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">已冲销</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{transaction.branchName} · {paymentLabels[transaction.paymentMethod] || transaction.paymentMethod} · {formatDateTime(transaction.occurredAt)}{transaction.vendorName ? ` · ${transaction.vendorName}` : ''}</p></div><div className="shrink-0 text-right"><p className={`text-sm font-black ${transaction.status === 'voided' ? 'text-slate-400 line-through' : transaction.type === 'income' ? 'text-emerald-600' : 'text-slate-950'}`}>{transaction.type === 'income' ? '+' : '-'} {formatMoney(transaction.amount)}</p><div className="mt-1 flex justify-end gap-2">{transaction.receiptUrl && <a href={transaction.receiptUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-600">收据</a>}{canManage && transaction.source === 'manual' && transaction.status === 'submitted' && <button type="button" onClick={() => onAction(transaction, 'approve')} className="text-[11px] font-bold text-emerald-600">审核</button>}{canManage && transaction.source === 'manual' && transaction.status !== 'voided' && <button type="button" onClick={() => onAction(transaction, 'void')} className="text-[11px] font-bold text-red-500">冲销</button>}</div></div></div>)}</div>;
}

function AnalysisPanel({ payload, loading }: { payload: FinancePayload; loading: boolean }) {
  const maxDaily = Math.max(1, ...payload.analytics.daily.flatMap(point => [point.income, point.expense]));
  const totalExpense = payload.analytics.expenses.reduce((total, item) => total + item.amount, 0) || 1;
  return <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-5"><div className="mb-6"><h3 className="font-black text-slate-950">近 30 天收支趋势</h3><p className="mt-1 text-xs text-slate-500">绿色为收入，红色为开支</p></div>{loading ? <div className="h-64 animate-pulse rounded-2xl bg-slate-100" /> : payload.analytics.daily.length ? <div className="flex h-64 items-end gap-1.5 overflow-x-auto border-b border-slate-200 pb-1">{payload.analytics.daily.map(point => <div key={point.date} className="flex h-full min-w-[28px] flex-1 items-end justify-center gap-0.5" title={`${point.date} 收入 ${formatMoney(point.income)} / 开支 ${formatMoney(point.expense)}`}><span className="w-2.5 rounded-t bg-emerald-400" style={{ height: `${Math.max(2, point.income / maxDaily * 100)}%` }} /><span className="w-2.5 rounded-t bg-red-300" style={{ height: `${Math.max(2, point.expense / maxDaily * 100)}%` }} /></div>)}</div> : <EmptyAnalysis />}</section><section className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-5"><h3 className="font-black text-slate-950">开支构成</h3><p className="mt-1 text-xs text-slate-500">按分类统计已记录开支</p><div className="mt-5 space-y-4">{payload.analytics.expenses.slice(0, 7).map((item, index) => <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-slate-700">{item.name}</span><span className="font-black text-slate-950">{formatMoney(item.amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, item.amount / totalExpense * 100)}%`, opacity: 1 - index * 0.08 }} /></div></div>)}{!payload.analytics.expenses.length && <EmptyAnalysis />}</div></section></div>;
}

function EntrySheet({ type, form, setForm, categories, branches, canChooseBranch, error, saving, onClose, onSubmit }: { type: FinanceType; form: EntryForm; setForm: React.Dispatch<React.SetStateAction<EntryForm>>; categories: FinancePayload['categories']; branches: FinancePayload['branches']; canChooseBranch: boolean; error: string; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  const update = (key: keyof EntryForm, value: EntryForm[keyof EntryForm]) => setForm(current => ({ ...current, [key]: value }));
  useEffect(() => { if (!form.categoryId && categories[0]) update('categoryId', categories[0].id); }, [categories, form.categoryId]);
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 backdrop-blur-sm sm:items-stretch sm:justify-end" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl sm:h-full sm:max-h-none sm:max-w-[480px] sm:rounded-none sm:border-l sm:border-slate-200"><header className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><p className={`text-xs font-black uppercase tracking-[.14em] ${type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>{type === 'income' ? 'Income' : 'Expense'}</p><h3 className="mt-1 text-xl font-black text-slate-950">{type === 'income' ? '记录额外收入' : '记录一笔开支'}</h3></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500" aria-label="关闭"><X size={18} /></button></header>{error && <div className="mx-5 mt-4"><ErrorNotice message={error} /></div>}<form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col"><div className="grid gap-4 overflow-y-auto p-5"><label><span className="mb-2 block text-xs font-bold text-slate-600">金额（RM）</span><div className="flex h-16 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:bg-white"><span className="mr-2 text-lg font-black text-slate-400">RM</span><input type="number" inputMode="decimal" min="0.01" step="0.01" max="1000000" value={form.amount} onChange={event => update('amount', event.target.value)} required autoFocus className="min-w-0 flex-1 bg-transparent text-3xl font-black text-slate-950 outline-none" placeholder="0.00" /></div></label><div className="grid grid-cols-2 gap-3"><SelectField label="分类" value={form.categoryId} onChange={value => update('categoryId', value)} required>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectField><SelectField label={type === 'expense' ? '付款方式' : '收款方式'} value={form.paymentMethod} onChange={value => update('paymentMethod', value)} required>{['cash', 'tng', 'bank', 'card', 'stripe', 'wallet'].map(method => <option key={method} value={method}>{paymentLabels[method]}</option>)}</SelectField></div>{canChooseBranch && <SelectField label="所属门店" value={form.branchId} onChange={value => update('branchId', value)} required><option value="">请选择门店</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</SelectField>}<label><span className="mb-2 block text-xs font-bold text-slate-600">发生时间</span><input type="datetime-local" value={form.occurredAt} onChange={event => update('occurredAt', event.target.value)} required className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white" /></label><label><span className="mb-2 block text-xs font-bold text-slate-600">{type === 'expense' ? '供应商 / 商家' : '收入来源'}（选填）</span><input value={form.vendorName} onChange={event => update('vendorName', event.target.value)} maxLength={100} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white" placeholder={type === 'expense' ? '例如：早市蔬菜档' : '例如：公司团餐'} /></label><label><span className="mb-2 block text-xs font-bold text-slate-600">备注（选填）</span><textarea value={form.note} onChange={event => update('note', event.target.value)} maxLength={500} rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white" placeholder="补充这笔收支的说明" /></label><label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 hover:border-blue-400 hover:bg-blue-50"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"><Camera size={20} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">拍照或上传收据</strong><small className="mt-1 block truncate text-slate-500">{form.receipt?.name || 'JPG、PNG、WebP，最大 5MB'}</small></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={event => update('receipt', event.target.files?.[0] || null)} /></label></div><footer className="mt-auto grid grid-cols-[.8fr_1.2fr] gap-3 border-t border-slate-100 p-5"><button type="button" onClick={onClose} className="h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">取消</button><button type="submit" disabled={saving} className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black text-white disabled:opacity-50 ${type === 'income' ? 'bg-emerald-600' : 'bg-slate-950'}`}>{saving ? <RefreshCw size={17} className="animate-spin" /> : <Check size={17} />}{saving ? '保存中' : '确认记录'}</button></footer></form></aside></div>;
}

function SelectField({ label, value, onChange, children, required = false }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; required?: boolean }) { return <label><span className="mb-2 block text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={event => onChange(event.target.value)} required={required} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white">{children}</select></label>; }
function ErrorNotice({ message }: { message: string }) { return <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{message}</div>; }
function EmptyAnalysis() { return <div className="flex h-48 flex-col items-center justify-center text-slate-400"><WalletCards size={30} /><p className="mt-2 text-sm font-bold">暂无足够数据</p></div>; }

function createEntryForm(type: FinanceType, branchId: string): EntryForm { return { type, branchId, categoryId: '', amount: '', paymentMethod: 'cash', occurredAt: toLocalDateTime(new Date()), vendorName: '', note: '', receipt: null }; }
function dateRangeForTab(tab: FinanceTab) { const now = new Date(); const start = tab === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); return { from: start.toISOString(), to: end.toISOString() }; }
function toLocalDateTime(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function formatMoney(value: number) { return `RM ${Number(value || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
async function readReceipt(file: File) { if (file.size > 5 * 1024 * 1024) throw new Error('收据图片不能超过 5MB'); if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('收据只支持 JPG、PNG 或 WebP'); const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(new Error('收据读取失败')); reader.readAsDataURL(file); }); return { fileName: file.name, contentType: file.type, dataBase64: dataUrl.split(',')[1] || '' }; }
