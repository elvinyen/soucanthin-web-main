import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeDollarSign,
  Banknote,
  Copy,
  Download,
  ExternalLink,
  History,
  Home,
  LogOut,
  ReceiptText,
  RefreshCw,
  Share2,
  UserRound,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import type { AuthMeResponse } from '../types/auth';
import type { AgentPortalData } from '../types/agent';
import AuthModal from './AuthModal';
import LanguageSelector from './LanguageSelector';

type WorkspaceTab = 'overview' | 'promotion' | 'orders' | 'account';

const tabs: { id: WorkspaceTab; icon: React.ElementType; labelKey: string; fallback: string; mobileLabelKey: string; mobileFallback: string }[] = [
  { id: 'overview', icon: Home, labelKey: 'agentWorkspace.tabs.overview', fallback: '工作台', mobileLabelKey: 'agentWorkspace.mobileTabs.home', mobileFallback: '首页' },
  { id: 'promotion', icon: Share2, labelKey: 'agentWorkspace.tabs.promotion', fallback: '推广中心', mobileLabelKey: 'agentWorkspace.mobileTabs.promotion', mobileFallback: '推广' },
  { id: 'orders', icon: ReceiptText, labelKey: 'agentWorkspace.ordersHub', fallback: '订单与佣金', mobileLabelKey: 'agentWorkspace.mobileTabs.orders', mobileFallback: '订单' },
  { id: 'account', icon: UserRound, labelKey: 'agentWorkspace.myAccount', fallback: '我的账户', mobileLabelKey: 'agentWorkspace.mobileTabs.account', mobileFallback: '我的' },
];

const mobileTabs = tabs;

const card = 'rounded-[1.6rem] border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(51,65,85,0.07)] backdrop-blur-sm';
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#9B7B50] focus:ring-4 focus:ring-[#9B7B50]/10';

export default function AgentApp() {
  const { t, i18n } = useTranslation();
  const [session, setSession] = useState<AuthMeResponse>({ success: true, authenticated: false });
  const [data, setData] = useState<AgentPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => readWorkspaceTab());

  const loadWorkspace = useCallback(async (nextSession?: AuthMeResponse) => {
    setLoading(true);
    setError('');
    try {
      const auth = nextSession || await fetchJson<AuthMeResponse>('/api/auth/me');
      setSession(auth);
      if (!auth.authenticated) {
        setData(null);
        return;
      }
      const portal = await fetchJson<AgentPortalData & { success: boolean }>(`/api/agent?lang=${encodeURIComponent(i18n.language)}`);
      setData(portal);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('agentPortal.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, t]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t('common.brandZh')}｜${t('agentWorkspace.brandSection', { defaultValue: '代理中心' })}`;
    return () => { document.title = previousTitle; };
  }, [t]);

  const navigate = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    const nextPath = tab === 'overview' ? '/agent' : `/agent/${tab}`;
    window.history.pushState({}, '', nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPopState = () => setActiveTab(readWorkspaceTab());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showNotice = (message: string) => {
    setError('');
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  if (loading && !session.authenticated) return <AgentLoading />;

  if (!session.authenticated) {
    return (
      <AuthModal
        isOpen
        presentation="page"
        onClose={() => undefined}
        onAuthenticated={(nextSession) => void loadWorkspace(nextSession)}
      />
    );
  }

  if (!data?.agent) {
    return <AgentAccessState data={data} error={error} onRetry={() => void loadWorkspace()} />;
  }

  const isActive = data.agent.status === 'active';
  const agentName = data.agent.fullName || session.user?.name || session.user?.displayPhone || '-';

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#292724]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-700/40 bg-[#292724] text-white lg:flex lg:flex-col xl:w-72">
        <WorkspaceBrand />
        <nav className="mt-6 flex-1 space-y-1 px-4">
          {tabs.map(tab => <NavButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => navigate(tab.id)} />)}
        </nav>
        <div className="border-t border-white/10 p-5">
          <p className="truncate text-sm font-bold">{agentName}</p>
          <p className="mt-1 font-mono text-xs text-white/40">{data.agent.agentNo}</p>
        </div>
      </aside>

      <div className="lg:pl-64 xl:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#EEF2F6]/90 backdrop-blur-xl">
          <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center transition-transform active:scale-95 lg:hidden" aria-label={t('common.brandZh')}>
                <img src="/logo/logo.png" alt={`${t('common.brandZh')} Logo`} className="h-8 w-auto object-contain sm:h-10" />
              </a>
              <div className="hidden lg:block">
                <p className="hidden text-[10px] font-bold tracking-[0.18em] text-[#A78345] sm:block">{t('common.brandZh')} · {t('agentWorkspace.brandSection', { defaultValue: '代理中心' })}</p>
                <h1 className="text-lg font-bold sm:mt-1 sm:text-xl">{tabLabel(activeTab, t)}</h1>
              </div>
            </div>
            <h1 className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-base font-black text-[#292724] lg:hidden">{t('agentWorkspace.brandSection', { defaultValue: '代理中心' })}</h1>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <button type="button" onClick={() => void loadWorkspace()} className="hidden h-10 w-10 place-items-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-sm sm:grid" aria-label={t('common.refresh')}><RefreshCw size={17} /></button>
            </div>
          </div>
        </header>

        {!isActive && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-800">
            {data.agent.status === 'suspended'
              ? t('agentWorkspace.suspendedNotice', { defaultValue: '代理账号已暂停，目前只能查看历史记录，推广与提现功能暂不可用。' })
              : t('agentWorkspace.terminatedNotice', { defaultValue: '代理合作已终止，目前只能查看历史记录。如有疑问请联系客服。' })}
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-8 sm:pt-7 lg:pb-12">
          {activeTab === 'overview' && <Overview data={data} onNavigate={navigate} />}
          {activeTab === 'promotion' && <Promotion data={data} enabled={isActive} onNotice={showNotice} onError={setError} />}
          {activeTab === 'orders' && <div className="space-y-4 sm:space-y-6"><Orders data={data} /><CommissionAdjustments data={data} /></div>}
          {activeTab === 'account' && <div className="space-y-4 sm:space-y-6"><Payouts data={data} enabled={isActive} onReload={loadWorkspace} onNotice={showNotice} onError={setError} /><Account session={session} data={data} onReload={loadWorkspace} onNotice={showNotice} onError={setError} onLogout={async () => {
            try {
              const response = await fetch('/api/auth/logout', { method: 'POST' });
              if (!response.ok) throw new Error('logout failed');
              setSession({ success: true, authenticated: false });
              setData(null);
            } catch {
              setError(t('userCenter.logoutFailed', { defaultValue: '退出登录失败，请检查网络后重试' }));
            }
          }} /></div>}
        </main>
      </div>

      <nav className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-3 right-3 z-30 grid grid-cols-4 rounded-[1.65rem] border border-white/80 bg-white/90 px-1.5 py-2 shadow-[0_16px_45px_rgba(30,41,59,0.16)] backdrop-blur-2xl lg:hidden">
        {mobileTabs.map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          const attentionCount = tab.id === 'orders'
            ? data.orders.filter(row => row.status === 'pending').length
            : tab.id === 'account'
              ? data.payouts.filter(row => row.status === 'pending').length + (data.profileChangeRequest && ['pending', 'changes_requested'].includes(data.profileChangeRequest.status) ? 1 : 0)
              : 0;
          return <button key={tab.id} type="button" onClick={() => navigate(tab.id)} aria-current={isSelected ? 'page' : undefined} className={`flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-0 rounded-[1.15rem] px-0.5 pt-1 font-sans text-[10px] tracking-[0.01em] transition-colors duration-300 ${isSelected ? 'text-[#9B7B50]' : 'text-[#8D8984]'}`}><span className={`relative grid place-items-center transition-all duration-300 ${isSelected ? '-translate-y-1.5 h-9 w-9 rounded-full bg-[#B38B4E] text-white shadow-[0_8px_20px_rgba(167,131,69,0.34)]' : 'h-8 w-10'}`}><Icon size={isSelected ? 18 : 19} strokeWidth={isSelected ? 2.25 : 1.8} />{attentionCount > 0 && <span className={`absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold leading-none text-white ring-2 ${isSelected ? 'ring-[#B38B4E]' : 'ring-white'}`}>{Math.min(attentionCount, 9)}</span>}</span><span className={`max-w-full truncate leading-none transition-all duration-300 ${isSelected ? '-translate-y-0.5 font-semibold' : 'font-medium'}`}>{t(tab.mobileLabelKey, { defaultValue: tab.mobileFallback })}</span></button>;
        })}
      </nav>

      {(notice || error) && <div role="status" className={`fixed left-1/2 top-24 z-[80] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm font-bold shadow-xl ${error ? 'bg-red-600 text-white' : 'bg-[#292724] text-white'}`}>{error || notice}</div>}
    </div>
  );
}

function WorkspaceBrand() {
  const { t } = useTranslation();
  return <a href="/agent" className="flex items-center gap-3 px-6 pt-7"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm"><img src="/logo/sct_logo.png" alt={`${t('common.brandZh')} Logo`} className="h-full w-full object-contain" /></span><span className="min-w-0"><span className="block truncate text-base font-bold">{t('common.brandZh')}</span><span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#E7C996]">{t('agentWorkspace.brandSection', { defaultValue: '代理中心' })}</span></span></a>;
}

function NavButton({ tab, active, onClick }: { key?: React.Key; tab: typeof tabs[number]; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const Icon = tab.icon;
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? 'bg-[#C7A46A] text-white shadow-lg shadow-black/10' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon size={18} /><span>{t(tab.labelKey, { defaultValue: tab.fallback })}</span></button>;
}

function Overview({ data, onNavigate }: { data: AgentPortalData; onNavigate: (tab: WorkspaceTab) => void }) {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<'today' | 'sevenDays' | 'thirtyDays'>('today');
  const recentOrders = data.orders.slice(0, 3);
  const periodEarnings = range === 'today' ? data.summary.todayEarnings : range === 'sevenDays' ? data.summary.sevenDayEarnings : data.summary.thirtyDayEarnings;
  const periodOrders = range === 'today' ? data.summary.todayOrders : range === 'sevenDays' ? data.summary.sevenDayOrders : data.summary.thirtyDayOrders;
  return <div className="space-y-4 sm:space-y-6">
    <section className="relative overflow-hidden rounded-[1.6rem] bg-[#292724] p-5 text-white shadow-2xl sm:rounded-[2rem] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[#C7A46A]/20" />
      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.18)] sm:h-14 sm:w-14">
              <img src="/logo/sct_logo.png" alt="" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold leading-tight text-white sm:text-2xl">{data.agent.fullName || '-'}</p>
              <p className="mt-1.5 truncate font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#E7C996] sm:text-sm">{data.agent.agentNo}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4 sm:mt-6">
            <p className="text-xs font-medium text-white/45 sm:text-sm">{t('agentPortal.available')}</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">RM {data.summary.available.toFixed(2)}</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={() => onNavigate('account')} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold sm:text-sm"><Banknote size={16} />{t('agentWorkspace.tabs.payouts', { defaultValue: '提现' })}</button>
          <button type="button" onClick={() => onNavigate('promotion')} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#C7A46A] px-4 py-2.5 text-xs font-bold sm:px-5 sm:text-sm"><Share2 size={16} />{t('agentWorkspace.shareNow', { defaultValue: '分享推广链接' })}</button>
        </div>
      </div>
    </section>
    <section className="space-y-3 sm:space-y-4">
      <div className="flex justify-end"><div className="inline-grid grid-cols-3 rounded-full border border-slate-200/80 bg-white p-1 shadow-sm">{(['today', 'sevenDays', 'thirtyDays'] as const).map(item => <button key={item} type="button" onClick={() => setRange(item)} className={`min-h-8 rounded-full px-3 text-[11px] font-bold transition sm:px-4 sm:text-xs ${range === item ? 'bg-[#292724] text-white' : 'text-slate-400'}`}>{t(`agentWorkspace.range.${item}`, { defaultValue: item === 'today' ? '今日' : item === 'sevenDays' ? '近7天' : '近30天' })}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard label={t('agentWorkspace.periodEarnings', { defaultValue: '期间收益' })} value={`RM ${(periodEarnings ?? 0).toFixed(2)}`} icon={History} featured />
        <MetricCard label={t('agentWorkspace.periodOrders', { defaultValue: '期间订单' })} value={String(periodOrders ?? 0)} icon={ReceiptText} />
        <MetricCard label={t('agentWorkspace.totalEarnings', { defaultValue: '累计收益' })} value={`RM ${(data.summary.totalEarnings ?? 0).toFixed(2)}`} icon={BadgeDollarSign} />
        <MetricCard label={t('agentWorkspace.totalUsers', { defaultValue: '累计用户' })} value={String(data.summary.referrals)} icon={Users} />
        <MetricCard label={t('agentPortal.pending')} value={`RM ${data.summary.pending.toFixed(2)}`} icon={History} />
        <MetricCard label={t('agentPortal.paid')} value={`RM ${data.summary.paid.toFixed(2)}`} icon={Banknote} />
      </div>
    </section>
    <section className={`${card} p-4 sm:p-7`}><div className="flex items-center justify-between"><h3 className="font-bold">{t('agentWorkspace.recentOrders', { defaultValue: '最近推广订单' })}</h3><button type="button" onClick={() => onNavigate('orders')} className="min-h-10 px-2 text-xs font-bold text-[#A78345]">{t('agentWorkspace.viewAll', { defaultValue: '查看全部' })}</button></div><div className="mt-2 divide-y divide-slate-100 sm:mt-4">{recentOrders.length ? recentOrders.map(order => <OrderRow key={order.id} order={order} locale={i18n.language} />) : <Empty text={t('agentWorkspace.emptyOrders', { defaultValue: '暂无推广订单' })} />}</div></section>
  </div>;
}

function Promotion({ data, enabled, onNotice, onError }: { data: AgentPortalData; enabled: boolean; onNotice: (message: string) => void; onError: (message: string) => void }) {
  const { t } = useTranslation();
  const qrRef = useRef<HTMLDivElement>(null);
  const agent = data.agent!;
  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); onNotice(t('agentPortal.copied', { label })); }
    catch { onError(t('agentPortal.actionFailed')); }
  };
  const download = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${t('agentPortal.qrFilename')}-${agent.referralCode}.svg`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); onNotice(t('agentPortal.qrDownloaded'));
  };
  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2.5 px-1 sm:px-0">
        <Share2 size={18} className="text-[#A78345]" />
        <h2 className="text-lg font-bold text-[#292724] sm:text-xl">{t('agentPortal.promotionTools')}</h2>
      </div>

      <div className="space-y-4 sm:space-y-5">
        <section className="relative isolate overflow-hidden rounded-[1.85rem] bg-[#262522] px-5 py-5 text-white shadow-[0_22px_60px_rgba(30,41,59,0.18)] sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(199,164,106,0.20)_0%,rgba(199,164,106,0.06)_38%,transparent_68%)]" />
          <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full border border-[#E7C996]/20" />
          <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-px w-3/5 bg-gradient-to-r from-[#C7A46A]/70 to-transparent" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.16)]"><img src="/logo/sct_logo.png" alt="" className="h-full w-full object-contain" /></span>
              <p className="text-xs font-bold tracking-[0.14em] text-white/65">{t('agentPortal.promotionTools')}</p>
            </div>
            <span className="rounded-full border border-[#E7C996]/20 bg-[#E7C996]/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-[#E7C996]">{t('agentPortal.referralCode')}</span>
          </div>

          <div className="mt-7 sm:mt-9">
            <p className="break-all font-mono text-[1.65rem] font-black tracking-[0.12em] text-[#F0D5A5] sm:text-4xl">{agent.referralCode}</p>
          </div>

          <div className="mt-7 flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.055] px-4 py-3.5 backdrop-blur-sm sm:mt-9 sm:px-5">
            <ExternalLink size={15} className="shrink-0 text-[#E7C996]" />
            <p className="min-w-0 flex-1 truncate text-xs text-white/55 sm:text-sm">{agent.referralUrl}</p>
          </div>
        </section>

        <section className={`${card} flex items-center justify-center p-5 sm:p-6`}>
          <div ref={qrRef} className="w-full max-w-[10rem] rounded-[1.3rem] border border-slate-200/80 bg-white p-2.5 shadow-[0_8px_24px_rgba(51,65,85,0.08)] sm:max-w-[11rem]">
              <QRCodeSVG value={agent.referralUrl} size={220} level="M" includeMargin className="h-auto w-full" aria-label={t('agentPortal.qrAria')} />
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <button type="button" disabled={!enabled} onClick={() => copy(agent.referralCode, t('agentPortal.referralCode'))} className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border border-slate-200/80 bg-white px-1 text-[10px] font-bold text-slate-600 shadow-[0_10px_28px_rgba(51,65,85,0.06)] transition active:scale-[0.97] disabled:opacity-40 sm:min-h-20 sm:text-xs"><Copy size={18} className="text-[#A78345]" /><span className="max-w-full truncate">{t('agentPortal.copyReferralCode')}</span></button>
          <button type="button" disabled={!enabled} onClick={() => copy(agent.referralUrl, t('agentPortal.referralLink'))} className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border border-slate-200/80 bg-white px-1 text-[10px] font-bold text-slate-600 shadow-[0_10px_28px_rgba(51,65,85,0.06)] transition active:scale-[0.97] disabled:opacity-40 sm:min-h-20 sm:text-xs"><ExternalLink size={18} className="text-[#A78345]" /><span className="max-w-full truncate">{t('agentPortal.copyReferralLink')}</span></button>
          <button type="button" disabled={!enabled} onClick={download} className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border border-slate-200/80 bg-white px-1 text-[10px] font-bold text-slate-600 shadow-[0_10px_28px_rgba(51,65,85,0.06)] transition active:scale-[0.97] disabled:opacity-40 sm:min-h-20 sm:text-xs"><Download size={18} className="text-[#A78345]" /><span className="max-w-full truncate">{t('agentPortal.downloadQr')}</span></button>
        </div>
      </div>
    </div>
  );
}

function Orders({ data }: { data: AgentPortalData }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'pending' | 'effective' | 'voided'>('all');
  const filteredOrders = data.orders.filter(order => filter === 'all' || (filter === 'effective' ? ['available', 'paid'].includes(order.status) : order.status === filter));
  const filters = ['all', 'pending', 'effective', 'voided'] as const;
  return <div className="space-y-4 sm:space-y-5">
    <div className="flex items-end justify-between gap-4 px-1 sm:px-0">
      <h2 className="text-xl font-bold tracking-tight text-[#292724] sm:text-2xl">{t('agentWorkspace.orderDetails', { defaultValue: '推广订单明细' })}</h2>
      <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[#A78345]/12 px-2.5 py-1 text-xs font-bold text-[#9B773C]">{filteredOrders.length}</span>
    </div>

    <section className="rounded-[1.35rem] border border-white/80 bg-white/70 p-1.5 shadow-[0_10px_30px_rgba(51,65,85,0.05)] backdrop-blur-sm sm:max-w-2xl sm:p-2">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {filters.map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-10 min-w-0 rounded-[1rem] px-1 text-[11px] font-semibold transition-all duration-200 sm:px-4 sm:text-xs ${filter === item ? 'bg-[#292724] text-white shadow-[0_7px_18px_rgba(41,39,36,0.18)]' : 'text-slate-500 hover:bg-white hover:text-[#292724]'}`}>{t(`agentWorkspace.orderFilters.${item}`, { defaultValue: item === 'all' ? '全部' : item === 'pending' ? '待确认' : item === 'effective' ? '已生效' : '已作废' })}</button>)}
      </div>
    </section>

    <section className={`${card} overflow-hidden px-4 sm:px-7`}>
      <OrderTableHeader />
      <div className="divide-y divide-stone-100 sm:mt-0">
        {filteredOrders.length ? filteredOrders.map(order => <OrderRow key={order.id} order={order} locale={i18n.language} />) : <div className="grid min-h-40 place-items-center py-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><ReceiptText className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-stone-400">{t('agentWorkspace.emptyOrders', { defaultValue: '暂无推广订单' })}</p></div></div>}
      </div>
    </section>
  </div>;
}

function CommissionAdjustments({ data }: { data: AgentPortalData }) {
  const { t, i18n } = useTranslation();
  const adjustments = data.commissions.filter(row => row.type === 'adjustment' || row.type === 'reversal');
  if (!adjustments.length) return null;
  return <section className={`${card} p-4 sm:p-7`}><h2 className="text-lg font-bold sm:text-xl">{t('agentWorkspace.otherCommissionChanges', { defaultValue: '其他佣金变动' })}</h2><div className="mt-3 divide-y divide-stone-100 sm:mt-5">{adjustments.map(row => <div key={row.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-bold">{row.note || t(`agentPortal.entryType.${row.type}`, { defaultValue: row.type })}</p><p className="mt-1 text-[11px] text-stone-400 sm:text-xs">{formatDate(row.createdAt, i18n.language)}</p></div><div className="shrink-0 text-right"><p className={`text-sm font-bold sm:text-base ${row.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{row.amount >= 0 ? '+' : ''}RM {row.amount.toFixed(2)}</p><StatusBadge status={row.status} /></div></div>)}</div></section>;
}

function Payouts({ data, enabled, onReload, onNotice, onError }: { data: AgentPortalData; enabled: boolean; onReload: () => Promise<void>; onNotice: (message: string) => void; onError: (message: string) => void }) {
  const { t, i18n } = useTranslation();
  const agent = data.agent!;
  const [submitting, setSubmitting] = useState(false);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '' });
  const submit = async () => {
    setSubmitting(true);
    try {
      await fetchJson('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request_payout', amount, paymentDetails: form }) });
      setAmount(''); setShowPayoutForm(false); onNotice(t('agentPortal.payoutSubmitted')); await onReload();
    } catch (cause) { onError(cause instanceof Error ? cause.message : t('agentPortal.actionFailed')); }
    finally { setSubmitting(false); }
  };
  return <div className="grid gap-4 sm:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
    <section className={`${card} p-5 sm:p-6`}><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5"><img src="/logo/sct_logo.png" alt="" className="h-full w-full object-contain" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{agent.fullName || agent.agentNo}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-400">{agent.agentNo}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${agent.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{t(`agentPortal.agentStatus.${agent.status}`, { defaultValue: agent.status })}</span></div><div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-sm text-stone-500">{t('agentPortal.available')}</p><p className="mt-2 text-3xl font-bold text-[#A78345] sm:text-4xl">RM {data.summary.available.toFixed(2)}</p></div><button type="button" disabled={!enabled} onClick={() => setShowPayoutForm(value => !value)} className="min-h-11 shrink-0 rounded-full bg-[#292724] px-5 text-xs font-bold text-white disabled:opacity-40 sm:text-sm">{showPayoutForm ? t('common.cancel', { defaultValue: '取消' }) : t('agentPortal.requestPayout')}</button></div><p className="mt-3 text-xs leading-5 text-stone-400">{t('agentPortal.payoutHint')}</p>{showPayoutForm && <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 sm:mt-6"><input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder={t('agentPortal.payoutAmount')} className={inputClass} /><input value={form.bankName} onChange={e => setForm(v => ({ ...v, bankName: e.target.value }))} placeholder={t('agentPortal.bankName')} className={inputClass} /><input value={form.accountName} onChange={e => setForm(v => ({ ...v, accountName: e.target.value }))} placeholder={t('agentPortal.accountName')} className={inputClass} /><input value={form.accountNumber} onChange={e => setForm(v => ({ ...v, accountNumber: e.target.value }))} placeholder={t('agentPortal.accountNumber')} className={inputClass} /><button disabled={!enabled || submitting || !amount || !form.bankName || !form.accountName || !form.accountNumber} onClick={submit} className="min-h-12 w-full rounded-full bg-[#292724] py-3 text-sm font-bold text-white disabled:opacity-40">{submitting ? t('common.loading', { defaultValue: '处理中…' }) : t('agentPortal.submitPayout')}</button></div>}</section>
    <section className={`${card} p-5 sm:p-6`}><h2 className="text-lg font-bold sm:text-xl">{t('agentWorkspace.payoutHistory', { defaultValue: '提现记录' })}</h2><div className="mt-3 divide-y divide-stone-100 sm:mt-5">{data.payouts.length ? data.payouts.map(row => <div key={row.id} className="py-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-xs font-bold sm:text-sm">{row.payoutNo}</p><p className="mt-1 truncate text-[11px] text-stone-400 sm:text-xs">{row.bankName}{row.maskedAccountNumber ? ` · ${row.maskedAccountNumber}` : ''}</p></div><div className="shrink-0 text-right"><p className="text-sm font-bold sm:text-base">RM {row.amount.toFixed(2)}</p><StatusBadge status={row.status} /></div></div><p className="mt-2 text-[11px] text-stone-400 sm:text-xs">{formatDate(row.requestedAt, i18n.language)}</p>{row.reviewNote && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{row.reviewNote}</p>}</div>) : <Empty text={t('agentWorkspace.emptyPayouts', { defaultValue: '暂无提现记录' })} />}</div></section>
  </div>;
}

function Account({ session, data, onReload, onNotice, onError, onLogout }: { session: AuthMeResponse; data: AgentPortalData; onReload: () => Promise<void>; onNotice: (message: string) => void; onError: (message: string) => void; onLogout: () => Promise<void> }) {
  const { t } = useTranslation();
  const agent = data.agent!;
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: agent.fullName, region: agent.region, promotionChannel: agent.promotionChannel, whatsappPhone: agent.whatsappPhone, reason: '' });
  const change = data.profileChangeRequest;
  const changeTone = change?.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : change?.status === 'rejected' || change?.status === 'cancelled' ? 'bg-red-50 text-red-700' : change?.status === 'changes_requested' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); onError('');
    try {
      await fetchJson('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request_profile_change', ...form }) });
      onNotice('资料修改申请已提交，审核通过后自动生效'); setEditing(false); await onReload();
    } catch (cause) { onError(cause instanceof Error ? cause.message : '提交失败'); }
    finally { setSubmitting(false); }
  };
  return <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold sm:text-xl">{t('agentWorkspace.agentProfile', { defaultValue: '代理资料' })}</h2><button type="button" disabled={change?.status === 'pending'} onClick={() => setEditing(value => !value)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-[#8B6B3E] disabled:opacity-40">{editing ? '取消' : '修改资料'}</button></div>
      {change && <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${changeTone}`}><p className="font-bold">{t(`agentWorkspace.profileChangeStatus.${change.status}`, { defaultValue: change.status === 'pending' ? '资料修改审核中' : change.status === 'changes_requested' ? '请补充资料后重新提交' : change.status === 'approved' ? '资料修改已通过' : change.status === 'rejected' ? '资料修改未通过' : '资料修改已取消' })} · {change.requestNo}</p>{change.reviewNote && <p className="mt-1 text-xs leading-5">{t('agentPortal.reviewNote')}：{change.reviewNote}</p>}</div>}
      {!editing ? <dl className="mt-4 space-y-4 text-sm sm:mt-5"><Info label="姓名" value={agent.fullName || session.user?.name || '-'} /><Info label="地区" value={agent.region || '-'} /><Info label="推广渠道" value={agent.promotionChannel || '-'} /><Info label={t('agentPortal.whatsappPhone')} value={agent.whatsappPhone || session.user?.displayPhone || '-'} /><Info label={t('agentWorkspace.agentNo', { defaultValue: '代理编号' })} value={agent.agentNo} /><Info label={t('agentPortal.status')} value={t(`agentPortal.agentStatus.${agent.status}`)} /><Info label={t('agentPortal.defaultCommission')} value={agent.commissionRate == null ? t('agentPortal.defaultCommission') : `${agent.commissionRate}%`} /></dl> : <form onSubmit={submit} className="mt-5 space-y-3"><input required value={form.fullName} onChange={e => setForm(v => ({ ...v, fullName: e.target.value }))} placeholder="真实姓名（必填）" className={inputClass} /><input required value={form.region} onChange={e => setForm(v => ({ ...v, region: e.target.value }))} placeholder="所在地区（必填）" className={inputClass} /><input required value={form.promotionChannel} onChange={e => setForm(v => ({ ...v, promotionChannel: e.target.value }))} placeholder="推广渠道（必填）" className={inputClass} /><input required value={form.whatsappPhone} onChange={e => setForm(v => ({ ...v, whatsappPhone: e.target.value }))} placeholder="WhatsApp 手机号（必填）" className={inputClass} /><textarea value={form.reason} onChange={e => setForm(v => ({ ...v, reason: e.target.value }))} placeholder="修改原因（选填）" rows={3} className={inputClass} /><p className="text-xs leading-5 text-slate-400">提交后不会立即覆盖现有资料，管理员审核通过后生效。</p><button disabled={submitting} className="min-h-12 w-full rounded-full bg-[#292724] py-3 text-sm font-bold text-white disabled:opacity-40">{submitting ? '提交中…' : change?.status === 'changes_requested' ? '重新提交审核' : '提交修改审核'}</button></form>}
    </section>
    <section className={`${card} p-5 sm:p-6`}><h2 className="text-lg font-bold sm:text-xl">{t('agentWorkspace.helpTitle', { defaultValue: '账户与帮助' })}</h2><p className="mt-3 text-sm leading-6 text-stone-500">代理身份申请与激活仍在主站个人中心完成；成为代理后，资料修改、推广、订单、佣金与提现都在这里管理。</p><div className="mt-5 space-y-3 sm:mt-6"><a href="/?account=agent" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-stone-200 py-3 text-sm font-bold"><ExternalLink size={16} />{t('agentWorkspace.openApplication', { defaultValue: '前往个人中心' })}</a><button onClick={() => void onLogout()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#292724] py-3 text-sm font-bold text-white"><LogOut size={16} />{t('common.logout')}</button></div></section>
  </div>;
}

function AgentAccessState({ data, error, onRetry }: { data: AgentPortalData | null; error: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const application = data?.application;
  return <div className="flex min-h-screen items-center justify-center bg-[#EEF2F6] p-5"><section className={`${card} w-full max-w-lg p-7 text-center sm:p-10`}><span className="mx-auto grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><img src="/logo/sct_logo.png" alt={`${t('common.brandZh')} Logo`} className="h-full w-full object-contain" /></span><h1 className="mt-6 text-2xl font-bold">{application ? t('agentPortal.application') : t('agentWorkspace.notAgentTitle', { defaultValue: '当前账号还不是代理' })}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{error || (application ? `${t(`agentPortal.applicationStatus.${application.status}`)} · ${application.applicationNo}` : t('agentWorkspace.notAgentHint', { defaultValue: '请先在主站个人中心提交代理申请并完成激活。' }))}</p>{application?.reviewNote && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{application.reviewNote}</p>}<a href="/?account=agent" className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white">{t('agentWorkspace.openApplication', { defaultValue: '前往个人中心' })}<ExternalLink size={16} /></a>{error && <button onClick={onRetry} className="mt-3 text-xs font-bold text-slate-500">{t('common.refresh')}</button>}</section></div>;
}

function AgentLoading() { return <div className="grid min-h-screen place-items-center bg-[#EEF2F6]"><span className="h-10 w-10 animate-spin rounded-full border-2 border-[#C7A46A]/20 border-t-[#C7A46A]" /></div>; }

function MetricCard({ label, value, icon: Icon, featured }: { label: string; value: string; icon: React.ElementType; featured?: boolean }) { return <div className={`${card} p-4 sm:p-5 ${featured ? 'bg-[#F7F9FC]' : ''}`}><div className="flex items-center justify-between"><p className="text-[11px] text-slate-400 sm:text-xs">{label}</p><Icon size={17} className="text-[#A78345]" /></div><p className="mt-2 whitespace-nowrap text-xl font-bold leading-none tracking-tight tabular-nums sm:mt-3 sm:text-2xl">{value}</p></div>; }

function OrderTableHeader() { const { t } = useTranslation(); return <div className="mt-6 hidden grid-cols-[1fr_0.8fr_0.8fr_auto] gap-4 border-b border-stone-100 pb-3 text-[11px] font-bold uppercase tracking-wider text-stone-400 sm:grid"><span>{t('agentWorkspace.tabs.orders', { defaultValue: '订单' })}</span><span>{t('agentWorkspace.eligibleAmount', { defaultValue: '计佣金额' })}</span><span>{t('agentPortal.commissionDetails', { defaultValue: '佣金' })}</span><span>{t('agentPortal.status', { defaultValue: '状态' })}</span></div>; }

function OrderRow({ order, locale }: { key?: React.Key; order: AgentPortalData['orders'][number]; locale: string }) { const { t } = useTranslation(); return <div className="py-4 sm:grid sm:grid-cols-[1fr_0.8fr_0.8fr_auto] sm:items-center sm:gap-4"><div className="flex items-start justify-between gap-3 sm:block"><div><p className="font-mono text-sm font-bold">{order.orderNo}</p><p className="mt-1 text-[11px] text-slate-400 sm:text-xs">{formatDate(order.createdAt, locale)}</p></div><div className="text-right sm:hidden"><p className="text-sm font-bold text-emerald-600">+RM {order.commissionAmount.toFixed(2)}</p><StatusBadge status={order.status} /></div></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:mt-0 sm:block sm:border-0 sm:bg-transparent sm:p-0"><div><p className="text-[10px] text-slate-400 sm:hidden">{t('agentWorkspace.eligibleAmount', { defaultValue: '计佣金额' })}</p><p className="mt-0.5 text-xs font-bold sm:mt-1 sm:text-sm">RM {order.eligibleAmount.toFixed(2)}</p></div><div className="text-right sm:hidden"><p className="text-[10px] text-slate-400">{t('agentPortal.defaultCommission', { defaultValue: '佣金比例' })}</p><p className="mt-0.5 text-xs font-bold">{order.commissionRate}%</p></div></div><div className="hidden sm:block"><p className="text-sm font-bold text-emerald-600">+RM {order.commissionAmount.toFixed(2)}</p><p className="mt-1 text-xs text-slate-400">{order.commissionRate}%</p></div><div className="hidden sm:block"><StatusBadge status={order.status} /></div></div>; }

function StatusBadge({ status }: { status: string }) { const { t } = useTranslation(); const colors = status === 'available' || status === 'paid' || status === 'approved' ? 'bg-emerald-50 text-emerald-700' : status === 'voided' || status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'; return <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${colors}`}>{t(`agentWorkspace.status.${status}`, { defaultValue: t(`agentPortal.ledgerStatus.${status}`, { defaultValue: status }) })}</span>; }

function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-4"><dt className="text-stone-400">{label}</dt><dd className="text-right font-bold">{value}</dd></div>; }
function Empty({ text }: { text: string }) { return <p className="py-12 text-center text-sm text-stone-400">{text}</p>; }
function formatDate(value: string, locale: string) { return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }); }
function tabLabel(tab: WorkspaceTab, t: ReturnType<typeof useTranslation>['t']) { const item = tabs.find(entry => entry.id === tab)!; return t(item.labelKey, { defaultValue: item.fallback }); }
function readWorkspaceTab(): WorkspaceTab {
  const segment = window.location.pathname.replace(/\/+$/, '').split('/')[2];
  if (segment === 'commissions') return 'orders';
  if (segment === 'payouts') return 'account';
  return tabs.some(tab => tab.id === segment) ? segment as WorkspaceTab : 'overview';
}

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload as T;
}
