import React, { useEffect, useRef, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Copy, Download, ExternalLink, Handshake, KeyRound, Send, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import type { AuthUser } from '../types/auth';

type PortalData = {
  application: null | {
    applicationNo: string;
    fullName: string;
    region: string;
    promotionChannel: string;
    whatsappPhone: string;
    message: string;
    status: 'pending' | 'changes_requested' | 'approved' | 'rejected' | 'activated';
    reviewNote: string;
    createdAt: string;
  };
  agent: null | {
    agentNo: string;
    fullName: string;
    referralCode: string;
    referralUrl: string;
    status: 'active' | 'suspended' | 'terminated';
    commissionRate: number | null;
    activatedAt: string;
  };
  summary: { pending: number; available: number; paid: number; referrals: number; orders: number; todayEarnings: number; sevenDayEarnings: number; thirtyDayEarnings: number; totalEarnings: number; todayOrders: number; sevenDayOrders: number; thirtyDayOrders: number };
  commissions: { id: string; type: string; amount: number; status: string; note?: string | null; createdAt: string }[];
  whatsappUrl: string;
};

interface AgentPortalProps {
  user: AuthUser;
  context?: 'account' | 'workspace';
}

const card = 'rounded-[1.65rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_45px_rgba(51,65,85,0.07)]';
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm text-[#292724] outline-none transition placeholder:text-slate-400 focus:border-[#9B7B50] focus:bg-white focus:ring-4 focus:ring-[#9B7B50]/10';

export function AgentPortal({ user, context = 'account' }: AgentPortalProps) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutForm, setPayoutForm] = useState({ bankName: '', accountName: '', accountNumber: '' });
  const [showReapply, setShowReapply] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    fullName: user.name || '',
    region: '',
    promotionChannel: '',
    whatsappPhone: user.displayPhone,
    message: '',
    consent: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agent?lang=${encodeURIComponent(i18n.language)}`);
      const payload = await readApiJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || t('agentPortal.loadFailed'));
      setData(payload);
      if (payload.application && ['changes_requested', 'rejected'].includes(payload.application.status)) {
        setForm(current => ({ ...current, fullName: payload.application.fullName, region: payload.application.region, promotionChannel: payload.application.promotionChannel, whatsappPhone: payload.application.whatsappPhone, message: payload.application.message || '', consent: false }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('agentPortal.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user.id, i18n.language]);

  useEffect(() => {
    const status = data?.application?.status;
    if (!status || !['pending', 'changes_requested'].includes(status)) return;
    const intervalId = window.setInterval(() => { void load(); }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [data?.application?.status]);

  const submit = async (body: Record<string, unknown>, successMessage: string) => {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, language: i18n.language }) });
      const payload = await readApiJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || t('agentPortal.actionFailed'));
      setNotice(successMessage);
      await load();
      return payload;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('agentPortal.actionFailed'));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const apply = async () => {
    await submit({ action: 'apply', ...form }, t('agentPortal.applicationSubmitted'));
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(t('agentPortal.copied', { label }));
  };

  const downloadQrCode = () => {
    const svg = qrCodeRef.current?.querySelector('svg');
    if (!svg || !data?.agent) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const downloadUrl = canvas.toDataURL('image/png');
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${t('agentPortal.qrFilename')}-${data.agent.referralCode}.png`;
      anchor.click();
      setNotice(t('agentPortal.qrDownloaded'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError(t('agentPortal.qrFailed'));
    };
    image.src = url;
  };

  const applicationStatusLabel = (status: string) => t(`agentPortal.applicationStatus.${status}`, { defaultValue: status });
  const agentStatusLabel = (status: string) => t(`agentPortal.agentStatus.${status}`, { defaultValue: status });
  const ledgerStatusLabel = (status: string) => t(`agentPortal.ledgerStatus.${status}`, { defaultValue: status });
  const entryTypeLabel = (type: string) => t(`agentPortal.entryType.${type}`, { defaultValue: type });

  if (loading && !data) return <div className={card}>{t('agentPortal.loading')}</div>;
  if (!data) return <Feedback error={error} notice={notice} />;

  if (data.agent && context === 'account') {
    const isActive = data.agent.status === 'active';
    return (
      <section className="space-y-3">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-[#292724] p-5 text-white shadow-[0_18px_45px_rgba(30,41,59,0.16)] sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-[#C7A46A]/18" />
          <div className="pointer-events-none absolute -right-9 -top-12 h-36 w-36 rounded-full border border-white/[0.04]" />
          <div className="relative flex min-w-0 items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#C7A46A]/20 bg-[#C7A46A]/12 text-[#E7C996]">
              <Handshake size={22} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-bold leading-tight">{data.agent.fullName || user.name || '-'}</h3>
              <p className="mt-1.5 truncate font-mono text-xs font-bold tracking-[0.08em] text-[#E7C996]">{data.agent.agentNo}</p>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 border-y border-white/10 py-4">
            <div className="border-r border-white/10 pr-4">
              <p className="text-[11px] text-white/40">{t('agentPortal.status')}</p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-bold"><span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />{agentStatusLabel(data.agent.status)}</p>
            </div>
            <div className="pl-4">
              <p className="text-[11px] text-white/40">{t('agentPortal.commissionRate', { defaultValue: '佣金比例' })}</p>
              <p className="mt-1.5 text-sm font-bold text-[#E7C996]">{data.agent.commissionRate == null ? t('agentPortal.defaultCommission') : `${data.agent.commissionRate}%`}</p>
            </div>
          </div>

          <a
            href="/agent"
            className="relative mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#C7A46A] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_25px_rgba(199,164,106,0.2)] transition active:scale-[0.98]"
          >
            {t('agentPortal.enterWorkspace', { defaultValue: '进入代理中心' })}
            <ExternalLink size={16} />
          </a>
        </div>

        <a href="/agent/account" className="flex min-h-14 items-center justify-between rounded-[1.25rem] border border-stone-100 bg-white px-4 py-3 text-sm font-bold text-[#2D2D2D] shadow-[0_10px_30px_rgba(45,45,45,0.06)] transition active:scale-[0.99]">
          <span>{t('agentWorkspace.agentProfile', { defaultValue: '代理资料' })}</span>
          <ExternalLink size={16} className="text-[#A78345]" />
        </a>
      </section>
    );
  }

  if (data.agent) {
    return (
      <section className="space-y-4">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#2B2B2B] p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E7C996]">{t('agentPortal.center')}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-bold">{data.agent.fullName || user.name || '-'}</h3><p className="mt-1 font-mono text-xs text-[#E7C996]">{data.agent.agentNo}</p><p className="mt-1 text-xs text-white/50">{t('agentPortal.status')}：{agentStatusLabel(data.agent.status)}</p></div>
            <span className="rounded-full bg-[#C7A46A]/20 px-3 py-1 text-xs font-bold text-[#E7C996]">{data.agent.commissionRate == null ? t('agentPortal.defaultCommission') : `${data.agent.commissionRate}%`}</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric label={t('agentPortal.pending')} value={`RM ${data.summary.pending.toFixed(2)}`} dark />
            <Metric label={t('agentPortal.available')} value={`RM ${data.summary.available.toFixed(2)}`} dark />
            <Metric label={t('agentPortal.paid')} value={`RM ${data.summary.paid.toFixed(2)}`} dark />
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center gap-3"><Handshake className="text-[#A78345]" size={20} /><h3 className="font-bold">{t('agentPortal.promotionTools')}</h3></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs text-stone-400">{t('agentPortal.referralCode')}</p><p className="mt-1 font-mono text-lg font-black tracking-wider text-[#A78345]">{data.agent.referralCode}</p>
              <p className="mt-3 break-words text-xs leading-5 text-stone-500">{data.agent.referralUrl}</p>
            </div>
            <div ref={qrCodeRef} className="mx-auto rounded-2xl border border-stone-100 bg-white p-3 shadow-sm sm:mx-0">
              <QRCodeSVG value={data.agent.referralUrl} size={136} level="M" includeMargin aria-label={t('agentPortal.qrAria')} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={() => copyText(data.agent!.referralCode, t('agentPortal.referralCode'))} className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-stone-200 px-3 py-3 text-center text-xs font-bold leading-5"><Copy className="shrink-0" size={15} /><span>{t('agentPortal.copyReferralCode')}</span></button>
            <button type="button" onClick={() => copyText(data.agent!.referralUrl, t('agentPortal.referralLink'))} className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full bg-[#C7A46A] px-3 py-3 text-center text-xs font-bold leading-5 text-white"><ExternalLink className="shrink-0" size={15} /><span>{t('agentPortal.copyReferralLink')}</span></button>
            <button type="button" onClick={downloadQrCode} className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-stone-200 px-3 py-3 text-center text-xs font-bold leading-5 sm:col-span-2 lg:col-span-1"><Download className="shrink-0" size={15} /><span>{t('agentPortal.downloadQr')}</span></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3"><Metric label={t('agentPortal.referredCustomers')} value={String(data.summary.referrals)} icon={<Users size={18} />} /><Metric label={t('agentPortal.referralOrders')} value={String(data.summary.orders)} icon={<BadgeDollarSign size={18} />} /></div>

        <div className={card}>
          <h3 className="font-bold">{t('agentPortal.requestPayout')}</h3>
          <p className="mt-1 text-xs text-stone-400">{t('agentPortal.payoutHint')}</p>
          <div className="mt-4 grid gap-2"><input value={payoutAmount} onChange={event => setPayoutAmount(event.target.value)} inputMode="decimal" placeholder={t('agentPortal.payoutAmount')} className={inputClass} /><input value={payoutForm.bankName} onChange={event => setPayoutForm(current => ({ ...current, bankName: event.target.value }))} placeholder={t('agentPortal.bankName')} className={inputClass} /><input value={payoutForm.accountName} onChange={event => setPayoutForm(current => ({ ...current, accountName: event.target.value }))} placeholder={t('agentPortal.accountName')} className={inputClass} /><input value={payoutForm.accountNumber} onChange={event => setPayoutForm(current => ({ ...current, accountNumber: event.target.value }))} placeholder={t('agentPortal.accountNumber')} className={inputClass} /><button type="button" disabled={submitting || !payoutForm.bankName || !payoutForm.accountName || !payoutForm.accountNumber} onClick={() => submit({ action: 'request_payout', amount: payoutAmount, paymentMethod: 'bank', paymentDetails: payoutForm }, t('agentPortal.payoutSubmitted'))} className="rounded-2xl bg-[#2D2D2D] py-3 text-sm font-bold text-white disabled:opacity-50">{t('agentPortal.submitPayout')}</button></div>
        </div>

        <div className={card}>
          <h3 className="font-bold">{t('agentPortal.commissionDetails')}</h3>
          <div className="mt-3 divide-y divide-stone-100">
            {data.commissions.length ? data.commissions.map(row => <div key={row.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{row.note || entryTypeLabel(row.type)}</p><p className="mt-1 text-[11px] text-stone-400">{new Date(row.createdAt).toLocaleString(i18n.language)}</p></div><div className="text-right"><p className={`font-bold ${row.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{row.amount >= 0 ? '+' : ''}RM {row.amount.toFixed(2)}</p><p className="mt-1 text-[11px] text-stone-400">{ledgerStatusLabel(row.status)}</p></div></div>) : <p className="py-6 text-center text-sm text-stone-400">{t('agentPortal.emptyCommissions')}</p>}
          </div>
        </div>
        <Feedback error={error} notice={notice} />
      </section>
    );
  }

  if (data.application) {
    const application = data.application;
    return (
      <section className="space-y-4">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(51,65,85,0.08)]">
          <div className="relative overflow-hidden bg-[#292724] p-5 text-white sm:p-6">
            <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full border border-[#C7A46A]/20" />
            <div className="relative flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-[#E7C996]"><CheckCircle2 size={20} /></span><div><h3 className="font-bold">{t('agentPortal.application')} · {applicationStatusLabel(application.status)}</h3><p className="mt-1 font-mono text-xs tracking-[0.08em] text-white/40">{application.applicationNo}</p></div></div>
          </div>
          <div className="p-5 sm:p-6">
          {application.reviewNote && <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('agentPortal.reviewNote')}：{application.reviewNote}</div>}
          {['pending', 'changes_requested'].includes(application.status) && <div className={`${application.reviewNote ? 'mt-3' : ''} rounded-2xl bg-[#F1F5F9] px-4 py-3 text-sm leading-6 text-slate-600`}><p className="font-bold text-slate-800">{t('agentPortal.nextStep')}</p><p className="mt-1">{t('agentPortal.pendingGuide')}</p></div>}
          {application.status === 'approved' && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"><p className="font-bold">{t('agentPortal.approvedTitle')}</p><p className="mt-1">{t('agentPortal.approvedGuide')}</p></div>}
          {data.whatsappUrl && <a href={data.whatsappUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#292724] py-3.5 text-sm font-bold text-white"><Send size={16} />{t('agentPortal.contactWhatsapp')}</a>}
          </div>
        </div>
        {application.status === 'approved' && <div className={card}><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F1F5F9] text-[#9B7B50]"><KeyRound size={18} /></span><h3 className="font-bold">{t('agentPortal.activateTitle')}</h3></div><p className="mt-3 text-xs leading-5 text-slate-500">{t('agentPortal.activateHint')}</p><input value={activationCode} onChange={event => setActivationCode(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder={t('agentPortal.activationPlaceholder')} className={`mt-4 ${inputClass} text-center font-mono tracking-[0.3em]`} /><button type="button" disabled={submitting || activationCode.length !== 8} onClick={() => submit({ action: 'activate', activationCode }, t('agentPortal.activated'))} className="mt-3 w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white disabled:opacity-50">{t('agentPortal.activateNow')}</button></div>}
        {application.status === 'rejected' && !showReapply && <button type="button" onClick={() => setShowReapply(true)} className="w-full rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white">{t('agentPortal.reapply')}</button>}
        {(application.status === 'changes_requested' || (application.status === 'rejected' && showReapply)) && (
          <div className={`${card} space-y-3 bg-[#F8FAFC]`}>
            <h3 className="font-bold">{application.status === 'changes_requested' ? t('agentPortal.supplementApplication') : t('agentPortal.resubmitApplication')}</h3>
            <Field label={t('agentPortal.fullName')} value={form.fullName} onChange={value => setForm(current => ({ ...current, fullName: value }))} />
            <Field label={t('agentPortal.region')} value={form.region} onChange={value => setForm(current => ({ ...current, region: value }))} />
            <Field label={t('agentPortal.promotionChannel')} value={form.promotionChannel} onChange={value => setForm(current => ({ ...current, promotionChannel: value }))} />
            <Field label={t('agentPortal.whatsappPhone')} value={form.whatsappPhone} onChange={value => setForm(current => ({ ...current, whatsappPhone: value }))} />
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-stone-400">{t('agentPortal.applicationMessage')}</span><textarea value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} rows={3} className={inputClass} /></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs leading-5 text-slate-600"><input type="checkbox" checked={form.consent} onChange={event => setForm(current => ({ ...current, consent: event.target.checked }))} className="mt-1 accent-[#A78345]" /><span>{t('agentPortal.resubmitConsent')}</span></label>
            <button type="button" disabled={submitting || !form.consent} onClick={apply} className="w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white disabled:opacity-50">{t('agentPortal.submitReview')}</button>
          </div>
        )}
        <Feedback error={error} notice={notice} />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(51,65,85,0.08)]">
      <div className="relative overflow-hidden bg-[#292724] p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full border border-[#C7A46A]/20" />
        <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-[#E7C996]"><Handshake size={21} /></span><div><h3 className="text-lg font-bold">{t('agentPortal.applyTitle')}</h3><p className="mt-1 text-xs leading-5 text-white/45">{t('agentPortal.applyDescription')}</p></div></div>
      </div>
      <div className="space-y-3 bg-[#F8FAFC] p-5 sm:p-6">
        <Field label={t('agentPortal.fullName')} value={form.fullName} onChange={value => setForm(current => ({ ...current, fullName: value }))} />
        <Field label={t('agentPortal.region')} value={form.region} onChange={value => setForm(current => ({ ...current, region: value }))} />
        <Field label={t('agentPortal.promotionChannel')} value={form.promotionChannel} placeholder={t('agentPortal.promotionPlaceholder')} onChange={value => setForm(current => ({ ...current, promotionChannel: value }))} />
        <Field label={t('agentPortal.whatsappPhone')} value={form.whatsappPhone} onChange={value => setForm(current => ({ ...current, whatsappPhone: value }))} />
        <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{t('agentPortal.applicationMessageOptional')}</span><textarea value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} rows={3} className={inputClass} /></label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs leading-5 text-slate-600"><input type="checkbox" checked={form.consent} onChange={event => setForm(current => ({ ...current, consent: event.target.checked }))} className="mt-1 accent-[#A78345]" /><span>{t('agentPortal.applyConsent')}</span></label>
        <button type="button" disabled={submitting || !form.consent} onClick={apply} className="w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white disabled:opacity-50">{t('agentPortal.submitApplication')}</button>
      </div>
      <Feedback error={error} notice={notice} />
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-500">{label}</span><input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className={inputClass} /></label>;
}

function Metric({ label, value, dark, icon }: { label: string; value: string; dark?: boolean; icon?: React.ReactNode }) {
  return <div className={`rounded-2xl p-3 ${dark ? 'bg-white/8' : 'border border-stone-100 bg-white shadow-sm'}`}><div className="flex items-center gap-2">{icon}<p className={`text-[11px] ${dark ? 'text-white/45' : 'text-stone-400'}`}>{label}</p></div><p className={`mt-1 font-bold ${dark ? 'text-[#E7C996]' : 'text-[#A78345]'}`}>{value}</p></div>;
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  return <div role="status" className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>;
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
