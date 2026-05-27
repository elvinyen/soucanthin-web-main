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
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AuthMeResponse, UserAddress, UserOrderSummary, WalletTransaction } from '../types/auth';
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
  mode?: 'sheet' | 'page';
}

type PaymentConfig = { tng: { accountName: string; accountNumber: string; qrImageUrl: string } };

const tabs: { id: UserCenterTab; labelKey: string; subtitle: string; icon: React.ElementType }[] = [
  { id: 'profile', labelKey: 'userCenter.tabs.profile', subtitle: 'Profile', icon: User },
  { id: 'wallet', labelKey: 'userCenter.tabs.wallet', subtitle: 'Wallet', icon: Wallet },
  { id: 'orders', labelKey: 'userCenter.tabs.orders', subtitle: 'Orders', icon: ReceiptText },
  { id: 'addresses', labelKey: 'userCenter.tabs.addresses', subtitle: 'Addresses', icon: MapPin },
  { id: 'coupons', labelKey: 'userCenter.tabs.coupons', subtitle: 'Coupons', icon: TicketPercent },
  { id: 'settings', labelKey: 'userCenter.tabs.settings', subtitle: 'Settings', icon: Settings },
];

const quickAmounts = [1, 5, 10, 20, 50, 100];
const glassPanel = 'rounded-[1.75rem] border border-white/55 bg-white/55 shadow-[0_18px_55px_rgba(45,45,45,0.12)] backdrop-blur-2xl';
const glassCard = 'rounded-3xl border border-white/60 bg-white/65 shadow-[0_14px_40px_rgba(45,45,45,0.08)] backdrop-blur-xl';
const glassInput = 'border border-white/70 bg-white/60 shadow-inner shadow-white/40 backdrop-blur-xl';
const ONLINE_PAYMENT_ENABLED = false;

const UserCenter: React.FC<UserCenterProps> = ({ isOpen, session, initialTab, onClose, onLogout, onRefresh, externalNotice, mode = 'sheet' }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<UserCenterTab>(initialTab);
  const [isPageRoot, setIsPageRoot] = useState(mode === 'page' && initialTab === 'profile');
  const [amount, setAmount] = useState(1);
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
  const [profilePhone, setProfilePhone] = useState('');
  const [phoneReqid, setPhoneReqid] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [walletBalance, setWalletBalance] = useState(session.wallet?.balance || 0);
  const [addressForm, setAddressForm] = useState({
    label: t('common.default'),
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
    setIsPageRoot(mode === 'page' && initialTab === 'profile');
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
    setProfilePhone(session.user?.displayPhone || '');
    setPhoneReqid('');
    setPhoneCode('');
    setPhoneCooldown(0);
    setWalletBalance(session.wallet?.balance || 0);
    loadTransactions();
  }, [isOpen, initialTab, externalNotice, session.user?.id, mode]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = window.setTimeout(() => setPhoneCooldown(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phoneCooldown]);

  useEffect(() => {
    setWalletBalance(session.wallet?.balance || 0);
  }, [session.wallet?.balance]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'wallet') return;
    const timer = window.setInterval(() => {
      loadTransactions();
      onRefresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isOpen, activeTab, onRefresh]);

  const loadTransactions = async () => {
    try {
      const res = await fetch('/api/wallet/transactions');
      const payload = await res.json();
      if (payload.success) {
        setTransactions(payload.transactions || []);
        if (payload.wallet) setWalletBalance(Number(payload.wallet.balance || 0));
      }
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
      const phoneChanged = profilePhone.trim() && profilePhone.trim() !== session.user?.displayPhone;
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileForm,
          ...(phoneChanged ? {
            phone: profilePhone,
            phoneReqid,
            phoneCode,
          } : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || t('userCenter.profileSaveFailed'));
      await onRefresh();
      if (payload.user?.displayPhone) setProfilePhone(payload.user.displayPhone);
      setPhoneReqid('');
      setPhoneCode('');
      showNotice(t('userCenter.profileSaved'));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('userCenter.profileSaveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestProfilePhoneOtp = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profilePhone }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || t('auth.sendFailed'));
      setPhoneReqid(payload.reqid);
      setProfilePhone(payload.displayPhone);
      setPhoneCode('');
      setPhoneCooldown(60);
      showNotice(t('userCenter.otpSent'));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('auth.sendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: t('common.default'),
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
      if (!res.ok || !payload.success) throw new Error(payload.error || t('userCenter.addressSaveFailed'));
      await onRefresh();
      resetAddressForm();
      showNotice(t('userCenter.addressSaved'));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('userCenter.addressSaveFailed'));
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
      if (!res.ok || !payload.success) throw new Error(payload.error || t('userCenter.addressDeleteFailed'));
      await onRefresh();
      if (editingAddressId === id) resetAddressForm();
      showNotice(t('userCenter.addressDeleted'));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('userCenter.addressDeleteFailed'));
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
      if (!res.ok || !payload.success) throw new Error(payload.error || t('userCenter.defaultAddressFailed'));
      await onRefresh();
      showNotice(t('userCenter.defaultAddressUpdated'));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('userCenter.defaultAddressFailed'));
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
    if (!receiptFile) throw new Error(t('cart.validation.receipt'));
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(t('cart.validation.readReceipt')));
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
      if (!res.ok || !payload.success) throw new Error(payload.error || t('userCenter.stripeCreateFailed'));
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
      if (!res.ok || !payload.success) throw new Error(payload.error || t('userCenter.tngSubmitFailed'));
      setNotice(t('userCenter.tngSubmitted'));
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
      if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
        throw new Error(t('userCenter.topUpRange'));
      }
      await submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userCenter.topUpFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPage = mode === 'page';

  if ((!isOpen && !isPage) || !session.user) return null;
  const activeMeta = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeMeta.icon;
  const openPageTab = (tab: UserCenterTab) => {
    setActiveTab(tab);
    setIsPageRoot(false);
  };

  return (
    <div className={isPage ? 'min-h-screen max-w-md mx-auto bg-[#F4EFE6]/80' : 'fixed inset-0 z-[115] max-w-md mx-auto'}>
      {!isPage && <div className="absolute inset-0 bg-black/45 backdrop-blur-md" onClick={onClose} />}
      <div className={isPage ? 'relative min-h-screen overflow-hidden bg-[#F4EFE6]/80' : 'absolute bottom-0 left-0 right-0 h-[85dvh] max-h-[85vh] overflow-hidden rounded-t-[2.5rem] border border-white/40 bg-[#F4EFE6]/70 shadow-[0_-28px_80px_rgba(0,0,0,0.28)] backdrop-blur-3xl animate-slide-up'}>
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_18%_0%,rgba(200,169,126,0.34),transparent_48%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.72),transparent_40%)] pointer-events-none" />
        {!isPage && <div className="relative w-12 h-1.5 bg-white/70 rounded-full mx-auto mt-4 flex-none shadow-sm" />}

        <div className="relative px-7 pt-6 pb-4 flex items-center justify-between flex-none">
          <div className="flex items-center space-x-3">
            {!isPage && (
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/55 text-[#2D2D2D] shadow-sm backdrop-blur-xl transition active:scale-95"
                aria-label={t('common.back')}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            {isPage && !isPageRoot && (
              <button
                onClick={() => setIsPageRoot(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/55 text-[#2D2D2D] shadow-sm backdrop-blur-xl transition active:scale-95"
                aria-label={t('common.back')}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold serif text-[#2D2D2D]">{isPage && isPageRoot ? t('common.mine') : t(activeMeta.labelKey)}</h2>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-0.5">{isPage && isPageRoot ? t('user.account') : activeMeta.subtitle}</p>
            </div>
          </div>
        </div>

        <div className={isPage ? 'relative overflow-y-visible px-6 pb-32 no-scrollbar' : 'relative h-[calc(85dvh-6.5rem)] max-h-[calc(85vh-6.5rem)] overflow-y-auto px-7 pb-10 no-scrollbar'}>
          {isPage && isPageRoot ? (
            <AccountHome
              session={session}
              walletBalance={walletBalance}
              pendingTransactions={pendingTransactions}
              onOpenTab={openPageTab}
              t={t}
            />
          ) : (
          <>
          <div className={`mb-6 p-5 ${glassPanel}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-[#2D2D2D] text-[#C8A97E] shadow-lg shadow-black/15">
                <ActiveIcon size={22} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#2D2D2D]">{session.user.displayPhone}</p>
                <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-stone-500">{getDisplayName(session.user.name, t)}</p>
              </div>
            </div>
          </div>

          {activeTab === 'profile' && (
            <section className="space-y-4">
              <div className={`space-y-3 p-5 ${glassCard}`}>
                <FormInput
                  label={t('userCenter.profileName')}
                  value={profileForm.name}
                  placeholder={t('userCenter.profilePlaceholder')}
                  onChange={(value) => setProfileForm(prev => ({ ...prev, name: value }))}
                />
                <div className="space-y-2">
                  <FormInput
                    label={t('userCenter.phone')}
                    value={profilePhone}
                    placeholder={t('userCenter.phonePlaceholder')}
                    type="tel"
                    onChange={(value) => {
                      setProfilePhone(value);
                      setPhoneReqid('');
                      setPhoneCode('');
                    }}
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={phoneCode}
                      onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      placeholder={t('userCenter.newPhoneOtp')}
                      className={`min-w-0 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#C8A97E] ${glassInput}`}
                    />
                    <button
                      type="button"
                      onClick={requestProfilePhoneOtp}
                      disabled={isSubmitting || phoneCooldown > 0 || !profilePhone.trim() || profilePhone.trim() === session.user.displayPhone}
                      className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs font-bold text-stone-600 shadow-sm backdrop-blur-xl disabled:opacity-50"
                    >
                      {phoneCooldown > 0 ? `${phoneCooldown}s` : t('userCenter.getOtp')}
                    </button>
                  </div>
                </div>
                <FormInput
                  label={t('userCenter.email')}
                  value={profileForm.email}
                  placeholder="name@example.com"
                  onChange={(value) => setProfileForm(prev => ({ ...prev, email: value }))}
                />
                <FormInput
                  label={t('userCenter.birthday')}
                  type="date"
                  value={profileForm.birthday}
                  onChange={(value) => setProfileForm(prev => ({ ...prev, birthday: value }))}
                />
                <button
                  onClick={saveProfile}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white shadow-xl shadow-black/15 disabled:bg-stone-200"
                >
                  <Save size={17} />
                  {t('userCenter.saveProfile')}
                </button>
              </div>
              <InfoRow label={t('userCenter.registeredAt')} value={formatDate(session.user.createdAt, i18n.language)} />
              <div className={`p-5 text-sm leading-6 text-stone-500 ${glassCard}`}>
                {t('userCenter.profileHint')}
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
              <div className="rounded-[2rem] border border-white/10 bg-[#2D2D2D]/95 p-6 text-white shadow-2xl shadow-black/25 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">{t('userCenter.walletBalance')}</p>
                <div className="mt-4 text-4xl font-bold serif">RM {walletBalance.toFixed(2)}</div>
                <p className="mt-3 text-xs text-white/50">{t('userCenter.pendingRecharge', { count: pendingTransactions })}</p>
              </div>

              <div className={`space-y-3 p-5 ${glassCard}`}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{t('userCenter.rechargeAmount')}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map(value => (
                    <button
                      key={value}
                      onClick={() => setAmount(value)}
                    className={`rounded-2xl border py-3 text-xs font-bold transition ${
                        amount === value ? 'border-[#C8A97E] bg-[#C8A97E] text-white shadow-lg shadow-[#C8A97E]/25' : 'border-white/60 bg-white/60 text-stone-500'
                      }`}
                    >
                      RM {value}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center justify-between rounded-2xl p-2 ${glassInput}`}>
                  <button
                    type="button"
                    onClick={() => setAmount(value => Math.max(1, value - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-stone-500 shadow-sm backdrop-blur-xl"
                    aria-label={t('userCenter.decreaseAmount')}
                  >
                    -
                  </button>
                  <div className="text-center text-sm font-bold text-[#2D2D2D]">RM {amount.toFixed(2)}</div>
                  <button
                    type="button"
                    onClick={() => setAmount(value => Math.min(1000, value + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-stone-500 shadow-sm backdrop-blur-xl"
                    aria-label={t('userCenter.increaseAmount')}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={`space-y-3 p-5 ${glassCard}`}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{t('cart.paymentMethod')}</h3>
                <div className={`grid gap-2 rounded-2xl border border-white/60 bg-white/45 p-1 backdrop-blur-xl ${ONLINE_PAYMENT_ENABLED ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button
                    type="button"
                    onClick={() => setRechargeMethod('tng')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                      rechargeMethod === 'tng' ? 'bg-[#2D2D2D] text-white shadow-sm' : 'text-stone-500'
                    }`}
                  >
                    <WalletCards size={16} />
                    {t('userCenter.tngTransfer')}
                  </button>
                  {ONLINE_PAYMENT_ENABLED && (
                    <button
                      type="button"
                      onClick={() => setRechargeMethod('stripe')}
                      className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                        rechargeMethod === 'stripe' ? 'bg-[#2D2D2D] text-white shadow-sm' : 'text-stone-500'
                      }`}
                    >
                      <CreditCard size={16} />
                      {t('userCenter.onlineTransfer')}
                    </button>
                  )}
                </div>

                {rechargeMethod === 'tng' || !ONLINE_PAYMENT_ENABLED ? (
                  <>
                    <div className="rounded-2xl border border-[#C8A97E]/25 bg-[#FBF7EF]/70 p-4 space-y-3 backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-stone-500">{t('userCenter.tngPayee')}</span>
                        <span className="text-right font-bold text-[#2D2D2D]">{paymentConfig?.tng.accountName || t('userCenter.configTngName')}</span>
                      </div>
                      {paymentConfig?.tng.qrImageUrl ? (
                        <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                          <img
                            src={paymentConfig.tng.qrImageUrl}
                            alt={t('cart.tngQrCode')}
                            className="mx-auto aspect-square w-full max-w-52 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-stone-500">{t('cart.tngAccount')}</span>
                          <span className="text-right font-mono font-bold text-[#2D2D2D]">{paymentConfig?.tng.accountNumber || t('userCenter.configTngNumber')}</span>
                        </div>
                      )}
                    </div>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C8A97E]/60 bg-[#FBF7EF]/70 px-4 py-4 text-xs font-bold text-[#C8A97E] backdrop-blur-xl">
                      <Upload size={16} />
                      <span className="truncate">{receiptFile ? receiptFile.name : t('cart.uploadReceipt')}</span>
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
                        className="h-40 w-full overflow-hidden rounded-2xl border border-white/60 bg-white/50 p-2 backdrop-blur-xl active:scale-[0.99]"
                        aria-label={t('userCenter.viewTngRecharge')}
                      >
                        <img src={receiptPreview} alt={t('userCenter.tngRechargeAlt')} className="h-full w-full object-contain" />
                      </button>
                    )}
                    <button
                      onClick={rechargeTng}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#C8A97E] py-4 text-sm font-bold text-white disabled:bg-stone-200"
                    >
                      <WalletCards size={17} />
                      {t('userCenter.submitTngReview')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-xs leading-5 text-stone-500 backdrop-blur-xl">
                      {t('userCenter.onlineRechargeHint')}
                    </div>
                    <button
                      onClick={rechargeStripe}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white disabled:bg-stone-200"
                    >
                      <CreditCard size={17} />
                      {t('userCenter.goOnlineTransfer')}
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
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{t('userCenter.walletTransactions')}</h3>
                {transactions.length === 0 ? (
                  <EmptyState text={t('userCenter.emptyWallet')} />
                ) : (
                  transactions.map(item => (
                    <div key={item.id} className={`p-4 ${glassCard}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#2D2D2D]">{labelTransaction(item, t)}</p>
                          <p className="mt-1 text-[11px] text-stone-400">{formatDate(item.createdAt, i18n.language)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#C8A97E]">RM {item.amount.toFixed(2)}</p>
                          <p className="mt-1 text-[11px] text-stone-400">{labelStatus(item, t)}</p>
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
                <EmptyState text={t('userCenter.emptyOrders')} />
              ) : (
                (session.orders || []).map(order => {
                  const expanded = expandedOrderId === order.id;
                  const orderStatus = getOrderStatusMeta(order.status, t);
                  return (
                  <div key={order.id} className={`p-5 ${glassCard}`}>
                    <button
                      onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-[#2D2D2D]">{order.orderNo}</p>
                        <p className="mt-1 text-[11px] text-stone-400">{formatDate(order.createdAt, i18n.language)}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${orderStatus.badgeClass}`}>
                          {orderStatus.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#C8A97E]">RM {(order.payableTotal ?? order.total).toFixed(2)}</p>
                        <p className="mt-1 text-[11px] text-stone-400">{labelPayment(order.paymentMethod, t)} · {labelPaymentStatus(order.paymentStatus, t)}</p>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-xs text-stone-500">
                        <OrderProgress order={order} t={t} />
                        <InfoLine label={t('userCenter.orderType')} value={order.orderType === 'takeaway' ? t('cart.takeaway') : t('cart.dineIn')} />
                        <InfoLine label={order.orderType === 'takeaway' ? t('userCenter.fullAddress') : t('ordersPage.tableLabel')} value={order.orderType === 'takeaway' ? order.deliveryAddress || '-' : order.tableNo || '-'} />
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
                                <span className="mt-1 block text-[11px] font-normal leading-4 text-stone-400">{t('common.note')}：{item.note}</span>
                              ) : null}
                            </span>
                            <span>RM {item.lineTotal.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="h-px bg-stone-100" />
                        <InfoLine label={t('common.subtotal')} value={`RM ${(order.subtotal || 0).toFixed(2)}`} />
                        <InfoLine label={t('common.deliveryFee')} value={`RM ${(order.deliveryFee || 0).toFixed(2)}`} />
                        <InfoLine label="SST 6%" value={`RM ${(order.serviceCharge || 0).toFixed(2)}`} />
                        <InfoLine label={t('common.discount')} value={`RM ${(order.discountAmount || 0).toFixed(2)}`} />
                        <InfoLine label={t('common.payable')} value={`RM ${(order.payableTotal ?? order.total).toFixed(2)}`} strong />
                        {order.note && <InfoLine label={t('common.note')} value={order.note} />}
                      </div>
                    )}
                  </div>
                )})
              )}
            </section>
          )}

          {activeTab === 'addresses' && (
            <section className="space-y-4">
              <div className={`space-y-3 p-5 ${glassCard}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
                    {editingAddressId ? t('userCenter.editAddress') : t('userCenter.newAddress')}
                  </h3>
                  <button onClick={resetAddressForm} className="text-xs font-bold text-[#C8A97E]">{t('common.clear')}</button>
                </div>
                <FormInput label={t('userCenter.label')} value={addressForm.label} onChange={(value) => setAddressForm(prev => ({ ...prev, label: value }))} />
                <FormInput label={t('userCenter.recipient')} value={addressForm.recipientName} onChange={(value) => setAddressForm(prev => ({ ...prev, recipientName: value }))} />
                <FormInput label={t('userCenter.phone')} value={addressForm.phone} onChange={(value) => setAddressForm(prev => ({ ...prev, phone: value }))} />
                <textarea
                  value={addressForm.address}
                  placeholder={t('userCenter.fullAddress')}
                  onChange={(event) => setAddressForm(prev => ({ ...prev, address: event.target.value }))}
                  rows={3}
                  className={`w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#C8A97E] ${glassInput}`}
                />
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(event) => setAddressForm(prev => ({ ...prev, isDefault: event.target.checked }))}
                  />
                  {t('userCenter.setDefaultAddress')}
                </label>
                <button
                  onClick={saveAddress}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white shadow-xl shadow-black/15 disabled:bg-stone-200"
                >
                  <Plus size={17} />
                  {editingAddressId ? t('userCenter.saveAddress') : t('userCenter.addAddress')}
                </button>
              </div>
              {(session.addresses || []).length === 0 ? (
                <EmptyState text={t('userCenter.emptyAddress')} />
              ) : (
                (session.addresses || []).map(address => (
                  <div key={address.id} className={`p-5 ${glassCard}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#2D2D2D]">
                          {address.label} {address.isDefault && <span className="text-[10px] text-[#C8A97E]">{t('common.default')}</span>}
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
                <EmptyState text={t('userCenter.emptyCoupons')} />
              ) : (
                (session.coupons || []).map(coupon => (
                  <div key={coupon.id} className={`p-5 ${glassCard}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#2D2D2D]">{coupon.title}</p>
                        <p className="mt-1 font-mono text-xs text-[#C8A97E]">{coupon.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#C8A97E]">- RM {coupon.discountAmount.toFixed(2)}</p>
                        <p className="mt-1 text-[11px] text-stone-400">{labelCouponStatus(coupon.status, t)}</p>
                      </div>
                    </div>
                    {coupon.description && <p className="mt-2 text-xs text-stone-500">{coupon.description}</p>}
                    <p className="mt-2 text-[11px] text-stone-400">{t('userCenter.expiry')}：{coupon.expiresAt ? formatDate(coupon.expiresAt, i18n.language) : t('common.longTerm')}</p>
                  </div>
                ))
              )}
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="space-y-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white shadow-xl shadow-black/15"
              >
                <LogOut size={17} />
                {t('common.logout')}
              </button>
              <button
                onClick={onRefresh}
                className="w-full rounded-full border border-white/60 bg-white/60 py-4 text-sm font-bold text-stone-600 shadow-sm backdrop-blur-xl"
              >
                {t('common.refresh')}
              </button>
            </section>
          )}
          </>
          )}
        </div>
      </div>
      {receiptPreview && isReceiptPreviewOpen && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/80 p-6" onClick={() => setIsReceiptPreviewOpen(false)}>
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white"
            onClick={() => setIsReceiptPreviewOpen(false)}
            aria-label={t('common.close')}
          >
            <X size={22} />
          </button>
          <img
            src={receiptPreview}
            alt={t('userCenter.tngRechargeAlt')}
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={`flex items-center justify-between gap-4 p-5 text-sm ${glassCard}`}>
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
      className={`block w-full min-w-0 max-w-full appearance-none rounded-2xl px-4 py-3 text-sm box-border outline-none focus:border-[#C8A97E] ${glassInput}`}
    />
  </label>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className={`px-5 py-10 text-center text-sm text-stone-400 ${glassCard}`}>
    {text}
  </div>
);

const AccountHome: React.FC<{
  session: AuthMeResponse;
  walletBalance: number;
  pendingTransactions: number;
  onOpenTab: (tab: UserCenterTab) => void;
  t: TFunction;
}> = ({ session, walletBalance, pendingTransactions, onOpenTab, t }) => {
  const summaries: Record<UserCenterTab, string> = {
    profile: session.user?.displayPhone || t('userCenter.summaryEdit'),
    wallet: `RM ${walletBalance.toFixed(2)}${pendingTransactions ? ` · ${t('userCenter.pendingReview', { count: pendingTransactions })}` : ''}`,
    orders: t('userCenter.ordersCount', { count: (session.orders || []).length }),
    addresses: t('userCenter.addressesCount', { count: (session.addresses || []).length }),
    coupons: t('userCenter.couponsCount', { count: (session.coupons || []).filter(coupon => coupon.status === 'available').length }),
    settings: t('userCenter.settingsSummary'),
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] bg-[#2D2D2D] p-6 text-white shadow-2xl shadow-black/20">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-[#C8A97E]">
            <User size={25} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold serif">{getDisplayName(session.user?.name, t)}</p>
            <p className="mt-1 truncate text-xs text-white/45">{session.user?.displayPhone}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <AccountMetric label={t('userCenter.metricsWallet')} value={`RM ${walletBalance.toFixed(2)}`} />
          <AccountMetric label={t('userCenter.metricsOrders')} value={`${(session.orders || []).length}`} />
          <AccountMetric label={t('userCenter.metricsCoupons')} value={`${(session.coupons || []).filter(coupon => coupon.status === 'available').length}`} />
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/60 shadow-[0_18px_55px_rgba(45,45,45,0.1)] backdrop-blur-2xl">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onOpenTab(tab.id)}
              className={`flex w-full items-center gap-4 px-5 py-4 text-left transition active:bg-white/70 ${
                index > 0 ? 'border-t border-white/60' : ''
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7F1E7] text-[#C8A97E]">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#2D2D2D]">{t(tab.labelKey)}</p>
                <p className="mt-1 truncate text-xs text-stone-400">{summaries[tab.id]}</p>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </button>
          );
        })}
      </div>
    </section>
  );
};

const AccountMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white/10 px-2 py-3">
    <p className="truncate text-sm font-bold text-[#C8A97E]">{value}</p>
    <p className="mt-1 text-[10px] text-white/40">{label}</p>
  </div>
);

const orderSteps: { status: UserOrderSummary['status']; labelKey: string }[] = [
  { status: 'pending_confirm', labelKey: 'ordersPage.status.pending_confirm' },
  { status: 'preparing', labelKey: 'ordersPage.status.preparing' },
  { status: 'delivering', labelKey: 'ordersPage.status.delivering' },
  { status: 'delivered', labelKey: 'ordersPage.status.delivered' },
  { status: 'completed', labelKey: 'ordersPage.status.completed' },
];

const OrderProgress: React.FC<{ order: UserOrderSummary; t: TFunction }> = ({ order, t }) => {
  const meta = getOrderStatusMeta(order.status, t);
  const currentIndex = orderSteps.findIndex(step => step.status === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className={`rounded-2xl border p-4 ${isCancelled ? 'border-red-100 bg-red-50/70' : 'border-white/70 bg-white/50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-bold ${isCancelled ? 'text-red-600' : 'text-[#2D2D2D]'}`}>{meta.label}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">{meta.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      {!isCancelled && (
        <div className="mt-4 grid grid-cols-5 gap-1">
          {orderSteps.map((step, index) => {
            const active = currentIndex >= index;
            return (
              <div key={step.status} className="min-w-0">
                <div className={`h-1.5 rounded-full ${active ? 'bg-[#C8A97E]' : 'bg-stone-200'}`} />
                <p className={`mt-2 truncate text-center text-[10px] ${active ? 'font-bold text-[#C8A97E]' : 'text-stone-400'}`}>{t(step.labelKey)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function formatDate(value?: string | null, language = 'en') {
  if (!value) return '-';
  return new Date(value).toLocaleString(`${language.split('-')[0]}-MY`, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function labelTransaction(item: WalletTransaction, t: TFunction) {
  if (item.method === 'stripe') return t('userCenter.transaction.stripe');
  if (item.method === 'tng') return t('userCenter.transaction.tng');
  if (item.type === 'payment') return t('userCenter.transaction.payment');
  return t('userCenter.transaction.adjustment');
}

function labelStatus(item: WalletTransaction, t: TFunction) {
  if (item.method === 'stripe' && item.status === 'pending') return t('userCenter.transactionStatus.awaitingPayment');
  if (item.method === 'tng' && item.status === 'pending') return t('userCenter.transactionStatus.pendingReview');
  return t(`userCenter.transactionStatus.${item.status}`);
}

function labelPayment(method: string | undefined, t: TFunction) {
  if (method === 'cash') return t('userCenter.payment.cash');
  if (method === 'tng') return 'TNG';
  if (method === 'stripe') return t('userCenter.payment.stripe');
  if (method === 'wallet') return t('userCenter.payment.wallet');
  return method || '-';
}

function labelPaymentStatus(status: string | undefined, t: TFunction) {
  return status ? t(`ordersPage.payment.${status}`, { defaultValue: status }) : '-';
}

function getOrderStatusMeta(status: string | undefined, t: TFunction) {
  const fallback = {
    label: t('ordersPage.status.pending_confirm'),
    description: t('ordersPage.steps.submittedDesc'),
    badgeClass: 'bg-[#C8A97E]/15 text-[#9B7848]',
  };
  const labels: Record<string, { label: string; description: string; badgeClass: string }> = {
    pending_confirm: fallback,
    preparing: {
      label: t('ordersPage.status.preparing'),
      description: t('ordersPage.steps.preparingDesc'),
      badgeClass: 'bg-amber-100 text-amber-700',
    },
    delivering: {
      label: t('ordersPage.status.delivering'),
      description: t('ordersPage.delivery.delivering'),
      badgeClass: 'bg-sky-100 text-sky-700',
    },
    delivered: {
      label: t('ordersPage.status.delivered'),
      description: t('ordersPage.steps.deliveredDesc'),
      badgeClass: 'bg-emerald-100 text-emerald-700',
    },
    completed: {
      label: t('ordersPage.status.completed'),
      description: t('ordersPage.steps.completedDesc'),
      badgeClass: 'bg-stone-200 text-stone-600',
    },
    cancelled: {
      label: t('ordersPage.status.cancelled'),
      description: t('ordersPage.steps.cancelledDesc'),
      badgeClass: 'bg-red-100 text-red-600',
    },
  };
  return labels[status || ''] || fallback;
}

function labelCouponStatus(status: string, t: TFunction) {
  return t(`userCenter.couponStatus.${status}`, { defaultValue: status });
}

function getDisplayName(name: string | undefined | null, t: TFunction) {
  return name?.trim() || t('common.memberFallback');
}

export default UserCenter;
