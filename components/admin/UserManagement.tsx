import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AdminTabs } from './AdminTabs';

type ApiClient = <T,>(path: string, init?: RequestInit) => Promise<T>;
type AdminRole = 'admin' | 'customer_service' | 'kitchen';

type UserSummary = {
  id: string;
  phone: string;
  displayPhone: string;
  name: string;
  email?: string | null;
  birthday?: string | null;
  source: string;
  createdAt: string;
  lastLoginAt?: string | null;
  walletBalance: number;
  walletCurrency: string;
  walletUpdatedAt?: string | null;
  orderCount: number;
  totalSpent: number;
};

type WalletTransaction = {
  id: string;
  type: string;
  method: string;
  amount: number;
  status: string;
  note: string;
  rechargeChannel?: string | null;
  referenceNo?: string | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  operatorName?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

type UserOrder = {
  id: string;
  order_no: string;
  payable_total: number;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
};

type UserCoupon = {
  id: string;
  status: string;
  source?: string | null;
  expires_at?: string | null;
  issued_at?: string | null;
  used_at?: string | null;
  coupons?: { code?: string | null; title?: string | null } | null;
};

type UserAddress = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  is_default: boolean;
};

type UserDetailPayload = {
  success: true;
  user: UserSummary;
  transactions: WalletTransaction[];
  orders: UserOrder[];
  coupons: UserCoupon[];
  addresses: UserAddress[];
};

type DetailTab = 'profile' | 'wallet' | 'orders' | 'coupons';

const rechargeChannels = [
  ['cash', '现金'],
  ['tng', 'Touch ‘n Go'],
  ['bank', '银行转账'],
  ['promotion', '活动赠送'],
  ['compensation', '余额补偿'],
  ['other', '其他'],
] as const;

export function UserManagement({ api, adminRole, onNotice }: {
  api: ApiClient;
  adminRole: AdminRole;
  onNotice?: (message: string) => void;
}) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('profile');
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeChannel, setRechargeChannel] = useState('cash');
  const [rechargeReason, setRechargeReason] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [rechargeRequestId, setRechargeRequestId] = useState(() => newRequestId());
  const [recharging, setRecharging] = useState(false);
  const [rechargeError, setRechargeError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const canRecharge = adminRole === 'admin';

  useEffect(() => {
    void loadUsers(1);
  }, []);

  const loadUsers = async (targetPage = page, searchValue = search) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(targetPage) });
      if (searchValue.trim()) params.set('search', searchValue.trim());
      const payload = await api<{ success: true; users: UserSummary[]; page: number; hasMore: boolean }>(`/api/admin/users?${params}`);
      setUsers(payload.users);
      setPage(payload.page);
      setHasMore(payload.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '用户加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (userId: string) => {
    setSelectedId(userId);
    setDetail(null);
    setDetailError('');
    setDetailTab('profile');
    setDetailLoading(true);
    setError('');
    try {
      const payload = await api<UserDetailPayload>(`/api/admin/users?id=${encodeURIComponent(userId)}`);
      setDetail(payload);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : '用户详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadUsers(1);
  };

  const openCreate = () => {
    setCreateName('');
    setCreatePhone('');
    setCreateError('');
    setCreateOpen(true);
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const payload = await api<{ success: true; customer: { id: string } }>('/api/admin/customers', {
        method: 'POST',
        body: JSON.stringify({ name: createName, phone: createPhone }),
      });
      setCreateOpen(false);
      setSearch('');
      onNotice?.('用户已创建，钱包已自动开通');
      await loadUsers(1, '');
      await loadDetail(payload.customer.id);
    } catch (createUserError) {
      setCreateError(createUserError instanceof Error ? createUserError.message : '用户创建失败');
    } finally {
      setCreating(false);
    }
  };

  const openRecharge = () => {
    setRechargeAmount('');
    setRechargeChannel('cash');
    setRechargeReason('');
    setReferenceNo('');
    setRechargeRequestId(newRequestId());
    setRechargeError('');
    setRechargeOpen(true);
  };

  const submitRecharge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail?.user) return;
    setRecharging(true);
    setRechargeError('');
    try {
      const result = await api<{ success: true; balanceBefore: number; balanceAfter: number }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          action: 'manual_recharge',
          userId: detail.user.id,
          amount: Number(rechargeAmount),
          channel: rechargeChannel,
          reason: rechargeReason,
          referenceNo,
          requestId: rechargeRequestId,
        }),
      });
      setRechargeOpen(false);
      onNotice?.(`充值成功，余额 RM ${result.balanceAfter.toFixed(2)}`);
      await Promise.all([loadDetail(detail.user.id), loadUsers(page)]);
    } catch (rechargeError) {
      setRechargeError(rechargeError instanceof Error ? rechargeError.message : '充值失败');
    } finally {
      setRecharging(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">用户列表</h2><p className="mt-1 text-xs text-slate-500">管理用户资料、钱包余额与消费记录</p></div><button type="button" onClick={openCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white"><Plus size={16} />新建用户</button></div>
        <form onSubmit={submitSearch} className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={event => setSearch(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#C7A46A] focus:bg-white" placeholder="搜索姓名、手机号或邮箱" />
          </div>
          <button type="submit" disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-50">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            查询用户
          </button>
        </form>

        {error && <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[inset_0_-1px_0_#e2e8f0]">
              <tr>
                <th className="px-5 py-3 text-left">用户</th>
                <th className="px-4 py-3 text-left">注册信息</th>
                <th className="px-4 py-3 text-right">钱包余额</th>
                <th className="px-4 py-3 text-right">订单</th>
                <th className="px-4 py-3 text-right">累计消费</th>
                <th className="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{(user.name || '用').slice(0, 1).toUpperCase()}</span>
                      <div><p className="font-bold text-slate-950">{user.name || '未命名用户'}</p><p className="mt-1 text-xs text-slate-500">{user.displayPhone || user.phone}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><p className="font-semibold text-slate-700">{user.source === 'admin_created' ? '后台创建' : '自主注册'}</p><p className="mt-1 text-xs text-slate-400">{formatDate(user.createdAt)}</p></td>
                  <td className="px-4 py-4 text-right text-base font-black text-emerald-700">RM {Number(user.walletBalance).toFixed(2)}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-700">{user.orderCount}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-950">RM {Number(user.totalSpent).toFixed(2)}</td>
                  <td className="px-5 py-4 text-right"><button type="button" onClick={() => void loadDetail(user.id)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-600">查看详情<ChevronRight size={14} /></button></td>
                </tr>
              ))}
              {!users.length && !loading && <tr><td colSpan={6} className="px-4 py-20 text-center text-sm font-bold text-slate-400">没有找到用户</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>第 {page} 页，每页最多 50 位用户</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => void loadUsers(page - 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 disabled:opacity-30" aria-label="上一页"><ChevronLeft size={16} /></button>
            <button type="button" disabled={!hasMore || loading} onClick={() => void loadUsers(page + 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 disabled:opacity-30" aria-label="下一页"><ChevronRight size={16} /></button>
          </div>
        </footer>
      </section>

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setSelectedId(null)}>
          <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelectedId(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 sm:hidden"><ArrowLeft size={18} /></button>
                <div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">User Detail</p><h3 className="mt-1 text-xl font-black text-slate-950">{detail?.user.name || '用户详情'}</h3></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><X size={18} /></button>
            </header>

            {detailLoading ? <div className="grid flex-1 place-items-center text-sm font-bold text-slate-400"><RefreshCw size={22} className="mb-3 animate-spin" />正在加载用户资料</div> : detailError || !detail ? <div className="grid flex-1 place-items-center p-8 text-center"><div><p className="font-bold text-red-600">{detailError || '用户详情加载失败'}</p><button type="button" onClick={() => void loadDetail(selectedId)} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">重新加载</button></div></div> : (
              <>
                <div className="border-b border-slate-100 bg-slate-950 p-5 text-white">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-bold">{detail.user.displayPhone}</p><p className="mt-1 text-xs text-white/50">注册于 {formatDate(detail.user.createdAt)}</p></div>
                    <div className="sm:text-right"><p className="text-xs text-white/50">钱包余额</p><p className="mt-1 text-3xl font-black text-emerald-300">RM {detail.user.walletBalance.toFixed(2)}</p></div>
                  </div>
                  {canRecharge && <button type="button" onClick={openRecharge} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-black text-emerald-950 hover:bg-emerald-300"><CircleDollarSign size={18} />钱包充值</button>}
                </div>

                <AdminTabs label="用户详情页面" value={detailTab} onChange={setDetailTab} items={[{ id: 'profile', label: '用户资料' }, { id: 'wallet', label: '钱包流水' }, { id: 'orders', label: '订单记录' }, { id: 'coupons', label: '优惠券' }]} />

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {detailTab === 'profile' && <ProfileTab detail={detail} />}
                  {detailTab === 'wallet' && <WalletTab transactions={detail.transactions} />}
                  {detailTab === 'orders' && <OrdersTab orders={detail.orders} />}
                  {detailTab === 'coupons' && <CouponsTab coupons={detail.coupons} />}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setCreateOpen(false)}>
          <form onSubmit={submitCreate} className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-100 p-5">
              <div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">New User</p><h3 className="mt-1 text-xl font-black text-slate-950">新建用户</h3><p className="mt-1 text-xs text-slate-500">创建后系统会自动开通余额为 RM 0.00 的钱包。</p></div>
              <button type="button" onClick={() => setCreateOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-label="关闭"><X size={17} /></button>
            </header>
            <div className="grid gap-4 p-5">
              {createError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{createError}</div>}
              <label><span className="mb-2 block text-xs font-bold text-slate-600">用户姓名</span><input required autoFocus maxLength={60} value={createName} onChange={event => setCreateName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#C7A46A] focus:bg-white" placeholder="请输入用户姓名" /></label>
              <label><span className="mb-2 block text-xs font-bold text-slate-600">马来西亚手机号</span><input required inputMode="tel" autoComplete="tel" value={createPhone} onChange={event => setCreatePhone(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#C7A46A] focus:bg-white" placeholder="例如：012-345 6789" /></label>
              <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><span>手机号会自动标准化并检查重复。用户之后可以使用相同手机号接收 OTP 登录。</span></div>
            </div>
            <footer className="grid grid-cols-[.8fr_1.2fr] gap-3 border-t border-slate-100 p-5">
              <button type="button" onClick={() => setCreateOpen(false)} className="h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">取消</button>
              <button type="submit" disabled={creating || !createName.trim() || !createPhone.trim()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white disabled:opacity-50">{creating ? <RefreshCw size={17} className="animate-spin" /> : <Plus size={17} />}{creating ? '正在创建' : '确认创建'}</button>
            </footer>
          </form>
        </div>
      )}

      {rechargeOpen && detail && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form onSubmit={submitRecharge} className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Manual Recharge</p><h3 className="mt-1 text-xl font-black">给 {detail.user.name || detail.user.displayPhone} 充值</h3></div><button type="button" onClick={() => setRechargeOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><X size={17} /></button></header>
            <div className="grid gap-4 p-5">
              {rechargeError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{rechargeError}</div>}
              <label><span className="mb-2 block text-xs font-bold text-slate-600">充值金额（RM）</span><div className="flex h-16 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-500 focus-within:bg-white"><span className="mr-2 text-lg font-black text-slate-400">RM</span><input required autoFocus type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" value={rechargeAmount} onChange={event => setRechargeAmount(event.target.value)} className="min-w-0 flex-1 bg-transparent text-3xl font-black outline-none" placeholder="0.00" /></div></label>
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-950 p-4 text-white"><div><p className="text-xs text-white/50">当前余额</p><p className="mt-1 text-lg font-black">RM {detail.user.walletBalance.toFixed(2)}</p></div><div className="text-right"><p className="text-xs text-white/50">充值后余额</p><p className="mt-1 text-lg font-black text-emerald-300">RM {(detail.user.walletBalance + (Number(rechargeAmount) || 0)).toFixed(2)}</p></div></div>
              <label><span className="mb-2 block text-xs font-bold text-slate-600">充值来源</span><select value={rechargeChannel} onChange={event => setRechargeChannel(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white">{rechargeChannels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className="mb-2 block text-xs font-bold text-slate-600">充值原因</span><textarea required minLength={2} maxLength={300} rows={3} value={rechargeReason} onChange={event => setRechargeReason(event.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white" placeholder="例如：门店收到现金，后台代充值" /></label>
              <label><span className="mb-2 block text-xs font-bold text-slate-600">付款参考编号（选填）</span><input maxLength={100} value={referenceNo} onChange={event => setReferenceNo(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-500 focus:bg-white" placeholder="收据号、银行流水号等" /></label>
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><span>确认后余额会立即入账并生成不可删除的审计流水。请再次核对用户和金额。</span></div>
            </div>
            <footer className="grid grid-cols-[.8fr_1.2fr] gap-3 border-t border-slate-100 p-5"><button type="button" onClick={() => setRechargeOpen(false)} className="h-12 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">取消</button><button type="submit" disabled={recharging || !rechargeAmount || !rechargeReason.trim()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white disabled:opacity-50">{recharging ? <RefreshCw size={17} className="animate-spin" /> : <Check size={17} />}{recharging ? '正在入账' : '确认充值'}</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ detail }: { detail: UserDetailPayload }) {
  const user = detail.user;
  return <div className="grid gap-5"><Section title="基本资料"><InfoGrid items={[["用户姓名", user.name || '未填写'], ["手机号", user.displayPhone], ["邮箱", user.email || '未填写'], ["生日", user.birthday || '未填写'], ["注册来源", user.source === 'admin_created' ? '后台创建' : '自主注册'], ["最后登录", user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '从未登录']]} /></Section><Section title={`配送地址（${detail.addresses.length}）`}>{detail.addresses.length ? <div className="grid gap-3">{detail.addresses.map(address => <div key={address.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2"><MapPin size={16} className="text-blue-500" /><p className="font-bold">{address.label}{address.is_default && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">默认</span>}</p></div><p className="mt-2 text-sm text-slate-600">{address.recipient_name} · {address.phone}</p><p className="mt-1 text-sm leading-6 text-slate-500">{address.address}</p></div>)}</div> : <Empty text="暂无配送地址" />}</Section></div>;
}

function WalletTab({ transactions }: { transactions: WalletTransaction[] }) {
  return transactions.length ? <div className="grid gap-3">{transactions.map(transaction => { const positive = transaction.type !== 'payment'; return <div key={transaction.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{positive ? <Banknote size={18} /> : <PackageCheck size={18} />}</span><div className="min-w-0"><p className="font-bold text-slate-950">{labelTransaction(transaction)}</p><p className="mt-1 truncate text-xs text-slate-500">{transaction.note || '无备注'}</p></div></div><p className={`shrink-0 text-base font-black ${positive ? 'text-emerald-600' : 'text-slate-950'}`}>{positive ? '+' : '-'} RM {transaction.amount.toFixed(2)}</p></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400"><span>{formatDateTime(transaction.completedAt || transaction.createdAt)}</span><span>{transaction.operatorName ? `操作人：${transaction.operatorName}` : transaction.referenceNo ? `参考号：${transaction.referenceNo}` : transaction.status}</span></div>{transaction.balanceAfter != null && <p className="mt-2 text-right text-xs font-bold text-slate-500">余额：RM {Number(transaction.balanceBefore || 0).toFixed(2)} → RM {transaction.balanceAfter.toFixed(2)}</p>}</div>; })}</div> : <Empty text="暂无钱包流水" />;
}

function OrdersTab({ orders }: { orders: UserOrder[] }) {
  return orders.length ? <div className="grid gap-3">{orders.map(order => <div key={order.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><div><p className="font-mono text-sm font-black text-slate-950">{order.order_no}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(order.created_at)} · {labelOrderStatus(order.status)}</p></div><p className="font-black">RM {Number(order.payable_total ?? order.total).toFixed(2)}</p></div>)}</div> : <Empty text="暂无订单记录" />;
}

function CouponsTab({ coupons }: { coupons: UserCoupon[] }) {
  return coupons.length ? <div className="grid gap-3">{coupons.map(coupon => <div key={coupon.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><div><p className="font-bold">{coupon.coupons?.title || '优惠券'}</p><p className="mt-1 font-mono text-xs text-amber-600">{coupon.coupons?.code || '—'}</p></div><div className="text-right"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{labelCouponStatus(coupon.status)}</span><p className="mt-2 text-[11px] text-slate-400">{coupon.expires_at ? `${formatDate(coupon.expires_at)} 到期` : '长期有效'}</p></div></div>)}</div> : <Empty text="暂无优惠券" />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h4 className="mb-3 text-xs font-black uppercase tracking-[.14em] text-slate-400">{title}</h4>{children}</section>; }
function InfoGrid({ items }: { items: string[][] }) { return <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1.5 text-sm font-bold text-slate-800">{value}</p></div>)}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm font-bold text-slate-400">{text}</div>; }

function newRequestId() { return globalThis.crypto?.randomUUID?.() || `recharge_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
function formatDateTime(value: string) { return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function labelTransaction(transaction: WalletTransaction) { if (transaction.type === 'payment') return '钱包消费'; if (transaction.type === 'refund') return '订单退款'; if (transaction.method === 'manual') return `${rechargeChannels.find(([value]) => value === transaction.rechargeChannel)?.[1] || '人工'}充值`; return `${transaction.method.toUpperCase()} 充值`; }
function labelOrderStatus(status: string) { return ({ pending_confirm: '待确认', waiting_kitchen: '待制作', cooking: '制作中', kitchen_done: '已出餐', preparing: '准备中', delivering: '配送中', delivered: '已送达', completed: '已完成', cancelled: '已取消', stock_issue: '缺货异常' } as Record<string, string>)[status] || status; }
function labelCouponStatus(status: string) { return ({ available: '可使用', reserved: '已锁定', used: '已使用', expired: '已过期', revoked: '已撤销' } as Record<string, string>)[status] || status; }
