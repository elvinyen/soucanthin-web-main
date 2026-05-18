import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  User,
  Wallet,
  ReceiptText,
  MapPin,
  TicketPercent,
  Settings,
  LogOut,
  Upload,
  CreditCard,
  WalletCards,
  ArrowLeft,
  Edit3,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type { AuthMeResponse, UserAddress, WalletTransaction } from '../types/auth';
import type { ReceiptImage } from '../types/order';

export type UserCenterTab = 'profile' | 'wallet' | 'orders' | 'addresses' | 'coupons' | 'settings';

interface UserCenterProps {
  isOpen: boolean;
  session: AuthMeResponse;
  initialTab: UserCenterTab;
  onClose: () => void;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  externalNotice?: string;
}

type PaymentConfig = { tng: { accountName: string; accountNumber: string } };

const tabs: { id: UserCenterTab; label: string; subtitle: string; icon: React.ElementType }[] = [
  { id: 'profile', label: '用户信息', subtitle: 'Profile', icon: User },
  { id: 'wallet', label: '我的钱包', subtitle: 'Wallet', icon: Wallet },
  { id: 'orders', label: '订单记录', subtitle: 'Orders', icon: ReceiptText },
  { id: 'addresses', label: '地址管理', subtitle: 'Addresses', icon: MapPin },
  { id: 'coupons', label: '优惠券', subtitle: 'Coupons', icon: TicketPercent },
  { id: 'settings', label: '设置', subtitle: 'Settings', icon: Settings },
];

const quickAmounts = [10, 20, 50, 100];

const UserCenter: React.FC<UserCenterProps> = ({ isOpen, session, initialTab, onClose, onLogout, onRefresh, externalNotice }) => {
  const [activeTab, setActiveTab] = useState<UserCenterTab>(initialTab);
  const [amount, setAmount] = useState(20);
  const [rechargeMethod, setRechargeMethod] = useState<'tng' | 'stripe'>('tng');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', email: '', birthday: '' });
  const [addressForm, setAddressForm] = useState({
    label: '默认地址',
    recipientName: '',
    phone: '',
    address: '',
    isDefault: true,
  });
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const pendingTransactions = useMemo(
    () => transactions.filter(item => item.method === 'tng' && item.status === 'pending').length,
    [transactions],
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    fetch('/api/payment-config')
      .then(res => res.json())
      .then(data => data.success && setPaymentConfig({ tng: data.tng }))
      .catch(() => undefined);
    if (externalNotice) {
      setNotice(externalNotice);
      setError('');
    }
    setProfileForm({
      name: session.user?.name || '',
      email: session.user?.email || '',
      birthday: session.user?.birthday || '',
    });
    loadTransactions();
  }, [isOpen, initialTab, externalNotice]);

  const loadTransactions = async () => {
    try {
      const res = await fetch('/api/wallet/transactions');
      const payload = await res.json();
      if (payload.success) setTransactions(payload.transactions || []);
    } catch {
      setTransactions([]);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    onLogout();
  };

  const showError = (message: string) => {
    setNotice('');
    setError(message);
  };

  const showNotice = (message: string) => {
    setError('');
    setNotice(message);
  };

  const saveProfile = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '用户资料保存失败');
      await onRefresh();
      showNotice('用户资料已保存。');
    } catch (err) {
      showError(err instanceof Error ? err.message : '用户资料保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: '默认地址',
      recipientName: session.user?.name || '',
      phone: session.user?.displayPhone || '',
      address: '',
      isDefault: (session.addresses || []).length === 0,
    });
  };

  const editAddress = (address: UserAddress) => {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      address: address.address,
      isDefault: address.isDefault,
    });
  };

  const saveAddress = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/addresses', {
        method: editingAddressId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingAddressId, ...addressForm }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '地址保存失败');
      await onRefresh();
      resetAddressForm();
      showNotice('地址已保存。');
    } catch (err) {
      showError(err instanceof Error ? err.message : '地址保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAddress = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/addresses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '地址删除失败');
      await onRefresh();
      if (editingAddressId === id) resetAddressForm();
      showNotice('地址已删除。');
    } catch (err) {
      showError(err instanceof Error ? err.message : '地址删除失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDefaultAddress = async (address: UserAddress) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/addresses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...address, isDefault: true }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '默认地址设置失败');
      await onRefresh();
      showNotice('默认地址已更新。');
    } catch (err) {
      showError(err instanceof Error ? err.message : '默认地址设置失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptChange = (file: File | null) => {
    setReceiptFile(file);
    setReceiptPreview(file ? URL.createObjectURL(file) : '');
    setIsReceiptPreviewOpen(false);
  };

  const buildReceiptImage = async (): Promise<ReceiptImage> => {
    if (!receiptFile) throw new Error('请上传 TNG 转账截图');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('无法读取付款截图'));
      reader.readAsDataURL(receiptFile);
    });
    return {
      fileName: receiptFile.name,
      mimeType: receiptFile.type,
      dataBase64: dataUrl.split(',')[1] || '',
    };
  };

  const rechargeStripe = async () => {
    await submitRecharge(async () => {
      const res = await fetch('/api/wallet/recharge/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '线上转账创建失败');
      window.location.href = payload.checkoutUrl;
    });
  };

  const rechargeTng = async () => {
    await submitRecharge(async () => {
      const receiptImage = await buildReceiptImage();
      const res = await fetch('/api/wallet/recharge/tng', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, receiptImage }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || 'TNG 充值提交失败');
      setNotice('TNG 充值已提交，员工审核通过后会自动入账。');
      setReceiptFile(null);
      setReceiptPreview('');
      setIsReceiptPreviewOpen(false);
      await loadTransactions();
      await onRefresh();
    });
  };

  const submitRecharge = async (submit: () => Promise<void>) => {
    setIsSubmitting(true);
    setNotice('');
    setError('');
    try {
      if (!Number.isFinite(amount) || amount < 5 || amount > 1000) {
        throw new Error('充值金额需介于 RM 5 至 RM 1000');
      }
      await submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '充值失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !session.user) return null;
  const activeMeta = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="fixed inset-0 z-[115] max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[94vh] overflow-hidden rounded-t-[2.5rem] bg-[#F5F5F5] shadow-2xl animate-slide-up">
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 flex-none" />

        <div className="px-8 pt-6 pb-4 flex items-center justify-between flex-none">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-stone-400 hover:text-[#2D2D2D] transition-colors"
              aria-label="返回"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold serif text-[#2D2D2D]">{activeMeta.label}</h2>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-0.5">{activeMeta.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-100 text-stone-500 rounded-full hover:bg-stone-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(94vh-6.5rem)] overflow-y-auto px-8 pb-10 no-scrollbar">
          <div className="mb-6 rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF7EF] text-[#C8A97E]">
                <ActiveIcon size={22} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#2D2D2D]">{session.user.displayPhone}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone-400">Soup Can Thin Member</p>
              </div>
            </div>
          </div>

          {activeTab === 'profile' && (
            <section className="space-y-4">
              <InfoRow label="手机号码" value={session.user.displayPhone} />
              <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
                <FormInput
                  label="账户名称"
                  value={profileForm.name}
                  placeholder="深夜食汤会员"
                  onChange={(value) => setProfileForm(prev => ({ ...prev, name: value }))}
                />
                <FormInput
                  label="邮箱"
                  value={profileForm.email}
                  placeholder="name@example.com"
                  onChange={(value) => setProfileForm(prev => ({ ...prev, email: value }))}
                />
                <FormInput
                  label="生日"
                  type="date"
                  value={profileForm.birthday}
                  onChange={(value) => setProfileForm(prev => ({ ...prev, birthday: value }))}
                />
                <button
                  onClick={saveProfile}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white disabled:bg-stone-200"
                >
                  <Save size={17} />
                  保存用户资料
                </button>
              </div>
              <InfoRow label="注册时间" value={formatDate(session.user.createdAt)} />
              <div className="rounded-3xl bg-white p-5 text-sm leading-6 text-stone-500 shadow-sm">
                登录后可集中查看钱包余额、充值流水、历史订单、地址与优惠券。
              </div>
              {(notice || error) && (
                <div className={`rounded-2xl px-4 py-3 text-xs leading-5 ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {error || notice}
                </div>
              )}
            </section>
          )}

          {activeTab === 'wallet' && (
            <section className="space-y-5">
              <div className="rounded-[2rem] bg-[#2D2D2D] p-6 text-white shadow-xl shadow-black/20">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Wallet Balance</p>
                <div className="mt-4 text-4xl font-bold serif">RM {(session.wallet?.balance || 0).toFixed(2)}</div>
                <p className="mt-3 text-xs text-white/50">待审核充值 {pendingTransactions} 笔</p>
              </div>

              <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">充值金额</h3>
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map(value => (
                    <button
                      key={value}
                      onClick={() => setAmount(value)}
                      className={`rounded-2xl py-3 text-xs font-bold ${
                        amount === value ? 'bg-[#C8A97E] text-white' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      RM {value}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={5}
                  max={1000}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="w-full rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4 text-sm font-bold outline-none focus:border-[#C8A97E]"
                />
              </div>

              <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">支付方式</h3>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
                  <button
                    type="button"
                    onClick={() => setRechargeMethod('tng')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                      rechargeMethod === 'tng' ? 'bg-[#2D2D2D] text-white shadow-sm' : 'text-stone-500'
                    }`}
                  >
                    <WalletCards size={16} />
                    TNG 转账
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechargeMethod('stripe')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                      rechargeMethod === 'stripe' ? 'bg-[#2D2D2D] text-white shadow-sm' : 'text-stone-500'
                    }`}
                  >
                    <CreditCard size={16} />
                    线上转账
                  </button>
                </div>

                {rechargeMethod === 'tng' ? (
                  <>
                    <div className="rounded-2xl border border-[#C8A97E]/20 bg-[#FBF7EF] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-stone-500">TNG 收款人</span>
                        <span className="text-right font-bold text-[#2D2D2D]">{paymentConfig?.tng.accountName || '请配置 TNG_ACCOUNT_NAME'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-stone-500">TNG 账号</span>
                        <span className="text-right font-mono font-bold text-[#2D2D2D]">{paymentConfig?.tng.accountNumber || '请配置 TNG_ACCOUNT_NUMBER'}</span>
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C8A97E]/60 bg-[#FBF7EF] px-4 py-4 text-xs font-bold text-[#C8A97E]">
                      <Upload size={16} />
                      <span className="truncate">{receiptFile ? receiptFile.name : '上传 TNG 转账截图'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => handleReceiptChange(event.target.files?.[0] || null)}
                      />
                    </label>
                    {receiptPreview && (
                      <button
                        type="button"
                        onClick={() => setIsReceiptPreviewOpen(true)}
                        className="h-40 w-full overflow-hidden rounded-2xl border border-stone-100 bg-stone-50 p-2 active:scale-[0.99]"
                        aria-label="查看TNG充值截图"
                      >
                        <img src={receiptPreview} alt="TNG充值截图预览" className="h-full w-full object-contain" />
                      </button>
                    )}
                    <button
                      onClick={rechargeTng}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#C8A97E] py-4 text-sm font-bold text-white disabled:bg-stone-200"
                    >
                      <WalletCards size={17} />
                      提交 TNG 审核
                    </button>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
                      线上转账将跳转至安全付款页。付款成功后钱包余额会自动入账。
                    </div>
                    <button
                      onClick={rechargeStripe}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white disabled:bg-stone-200"
                    >
                      <CreditCard size={17} />
                      前往线上转账
                    </button>
                  </>
                )}
              </div>

              {(notice || error) && (
                <div className={`rounded-2xl px-4 py-3 text-xs leading-5 ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {error || notice}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">钱包流水</h3>
                {transactions.length === 0 ? (
                  <EmptyState text="暂无钱包流水" />
                ) : (
                  transactions.map(item => (
                    <div key={item.id} className="rounded-3xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#2D2D2D]">{labelTransaction(item)}</p>
                          <p className="mt-1 text-[11px] text-stone-400">{formatDate(item.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#C8A97E]">RM {item.amount.toFixed(2)}</p>
                          <p className="mt-1 text-[11px] text-stone-400">{labelStatus(item)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === 'orders' && (
            <section className="space-y-3">
              {(session.orders || []).length === 0 ? (
                <EmptyState text="暂无登录订单记录" />
              ) : (
                (session.orders || []).map(order => {
                  const expanded = expandedOrderId === order.id;
                  return (
                  <div key={order.id} className="rounded-3xl bg-white p-5 shadow-sm">
                    <button
                      onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-[#2D2D2D]">{order.orderNo}</p>
                        <p className="mt-1 text-[11px] text-stone-400">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#C8A97E]">RM {(order.payableTotal ?? order.total).toFixed(2)}</p>
                        <p className="mt-1 text-[11px] text-stone-400">{labelPayment(order.paymentMethod)} · {labelPaymentStatus(order.paymentStatus)}</p>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-xs text-stone-500">
                        <InfoLine label="订单类型" value={order.orderType === 'takeaway' ? '外卖' : '堂食'} />
                        <InfoLine label={order.orderType === 'takeaway' ? '地址' : '桌号'} value={order.orderType === 'takeaway' ? order.deliveryAddress || '-' : order.tableNo || '-'} />
                        {(order.items || []).map(item => (
                          <div key={item.id || item.name} className="flex justify-between gap-3">
                            <span className="text-[#2D2D2D]">
                              {item.name} x{item.quantity}
                              {item.options?.length ? (
                                <span className="mt-1 block text-[11px] font-normal leading-4 text-stone-400">
                                  {item.options.map(option => `${option.groupName}: ${option.name}`).join(' · ')}
                                </span>
                              ) : null}
                              {item.note ? (
                                <span className="mt-1 block text-[11px] font-normal leading-4 text-stone-400">备注：{item.note}</span>
                              ) : null}
                            </span>
                            <span>RM {item.lineTotal.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="h-px bg-stone-100" />
                        <InfoLine label="小计" value={`RM ${(order.subtotal || 0).toFixed(2)}`} />
                        <InfoLine label="SST 6%" value={`RM ${(order.serviceCharge || 0).toFixed(2)}`} />
                        <InfoLine label="优惠" value={`RM ${(order.discountAmount || 0).toFixed(2)}`} />
                        <InfoLine label="实付" value={`RM ${(order.payableTotal ?? order.total).toFixed(2)}`} strong />
                        {order.note && <InfoLine label="备注" value={order.note} />}
                      </div>
                    )}
                  </div>
                )})
              )}
            </section>
          )}

          {activeTab === 'addresses' && (
            <section className="space-y-4">
              <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
                    {editingAddressId ? '编辑地址' : '新增地址'}
                  </h3>
                  <button onClick={resetAddressForm} className="text-xs font-bold text-[#C8A97E]">清空</button>
                </div>
                <FormInput label="标签" value={addressForm.label} onChange={(value) => setAddressForm(prev => ({ ...prev, label: value }))} />
                <FormInput label="收件人" value={addressForm.recipientName} onChange={(value) => setAddressForm(prev => ({ ...prev, recipientName: value }))} />
                <FormInput label="电话" value={addressForm.phone} onChange={(value) => setAddressForm(prev => ({ ...prev, phone: value }))} />
                <textarea
                  value={addressForm.address}
                  placeholder="详细地址"
                  onChange={(event) => setAddressForm(prev => ({ ...prev, address: event.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-[#C8A97E]"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(event) => setAddressForm(prev => ({ ...prev, isDefault: event.target.checked }))}
                  />
                  设为默认地址
                </label>
                <button
                  onClick={saveAddress}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white disabled:bg-stone-200"
                >
                  <Plus size={17} />
                  {editingAddressId ? '保存地址' : '新增地址'}
                </button>
              </div>
              {(session.addresses || []).length === 0 ? (
                <EmptyState text="暂无地址" />
              ) : (
                (session.addresses || []).map(address => (
                  <div key={address.id} className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#2D2D2D]">
                          {address.label} {address.isDefault && <span className="text-[10px] text-[#C8A97E]">默认</span>}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">{address.recipientName} · {address.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        {!address.isDefault && (
                          <button onClick={() => setDefaultAddress(address)} className="text-stone-400"><CheckCircle2 size={16} /></button>
                        )}
                        <button onClick={() => editAddress(address)} className="text-stone-400"><Edit3 size={16} /></button>
                        <button onClick={() => deleteAddress(address.id)} className="text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-stone-500">{address.address}</p>
                  </div>
                ))
              )}
              {(notice || error) && (
                <div className={`rounded-2xl px-4 py-3 text-xs leading-5 ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {error || notice}
                </div>
              )}
            </section>
          )}

          {activeTab === 'coupons' && (
            <section className="space-y-3">
              {(session.coupons || []).length === 0 ? (
                <EmptyState text="暂无可用优惠券" />
              ) : (
                (session.coupons || []).map(coupon => (
                  <div key={coupon.id} className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#2D2D2D]">{coupon.title}</p>
                        <p className="mt-1 font-mono text-xs text-[#C8A97E]">{coupon.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#C8A97E]">- RM {coupon.discountAmount.toFixed(2)}</p>
                        <p className="mt-1 text-[11px] text-stone-400">{labelCouponStatus(coupon.status)}</p>
                      </div>
                    </div>
                    {coupon.description && <p className="mt-2 text-xs text-stone-500">{coupon.description}</p>}
                    <p className="mt-2 text-[11px] text-stone-400">有效期：{coupon.expiresAt ? formatDate(coupon.expiresAt) : '长期有效'}</p>
                  </div>
                ))
              )}
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="space-y-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white"
              >
                <LogOut size={17} />
                退出登录
              </button>
              <button
                onClick={onRefresh}
                className="w-full rounded-full bg-white py-4 text-sm font-bold text-stone-600 shadow-sm"
              >
                刷新个人中心
              </button>
            </section>
          )}
        </div>
      </div>
      {receiptPreview && isReceiptPreviewOpen && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/80 p-6" onClick={() => setIsReceiptPreviewOpen(false)}>
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white"
            onClick={() => setIsReceiptPreviewOpen(false)}
            aria-label="关闭截图预览"
          >
            <X size={22} />
          </button>
          <img
            src={receiptPreview}
            alt="TNG充值截图大图"
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-3xl bg-white p-5 text-sm shadow-sm">
    <span className="text-stone-400">{label}</span>
    <span className="text-right font-bold text-[#2D2D2D]">{value}</span>
  </div>
);

const InfoLine: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex justify-between gap-4">
    <span className="text-stone-400">{label}</span>
    <span className={`text-right ${strong ? 'font-bold text-[#2D2D2D]' : 'text-stone-600'}`}>{value}</span>
  </div>
);

const FormInput: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, type = 'text', onChange }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-[#C8A97E]"
    />
  </label>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-3xl bg-white px-5 py-10 text-center text-sm text-stone-400 shadow-sm">
    {text}
  </div>
);

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-MY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function labelTransaction(item: WalletTransaction) {
  if (item.method === 'stripe') return '线上转账充值';
  if (item.method === 'tng') return 'TNG 充值';
  if (item.type === 'payment') return '钱包支付';
  return '钱包调整';
}

function labelStatus(item: WalletTransaction) {
  if (item.method === 'stripe' && item.status === 'pending') return '待付款';
  if (item.method === 'tng' && item.status === 'pending') return '待审核';
  const labels: Record<WalletTransaction['status'], string> = {
    pending: '处理中',
    succeeded: '已完成',
    rejected: '已拒绝',
    failed: '失败',
  };
  return labels[item.status];
}

function labelPayment(method?: string) {
  if (method === 'cash') return '现金';
  if (method === 'tng') return 'TNG';
  if (method === 'stripe') return '线上付款';
  if (method === 'wallet') return '钱包';
  return method || '-';
}

function labelPaymentStatus(status?: string) {
  const labels: Record<string, string> = {
    pay_at_counter: '到店/送达付款',
    pending_review: '待审核',
    awaiting_payment: '待付款',
    paid: '已付款',
  };
  return labels[status || ''] || status || '-';
}

function labelCouponStatus(status: string) {
  const labels: Record<string, string> = {
    available: '可使用',
    used: '已使用',
    expired: '已过期',
  };
  return labels[status] || status;
}

export default UserCenter;
