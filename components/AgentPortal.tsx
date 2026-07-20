import React, { useEffect, useRef, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Copy, Download, ExternalLink, Handshake, KeyRound, Send, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
    referralCode: string;
    referralUrl: string;
    status: 'active' | 'suspended' | 'terminated';
    commissionRate: number | null;
    activatedAt: string;
  };
  summary: { pending: number; available: number; paid: number; referrals: number; orders: number };
  commissions: { id: string; type: string; amount: number; status: string; note?: string | null; createdAt: string }[];
  whatsappUrl: string;
};

interface AgentPortalProps {
  user: AuthUser;
}

const card = 'rounded-[1.65rem] border border-stone-100 bg-white p-5 shadow-[0_14px_40px_rgba(45,45,45,0.06)]';
const inputClass = 'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#C8A97E]';

export function AgentPortal({ user }: AgentPortalProps) {
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
      const response = await fetch('/api/agent');
      const payload = await readApiJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || '无法读取代理资料');
      setData(payload);
      if (payload.application && ['changes_requested', 'rejected'].includes(payload.application.status)) {
        setForm(current => ({ ...current, fullName: payload.application.fullName, region: payload.application.region, promotionChannel: payload.application.promotionChannel, whatsappPhone: payload.application.whatsappPhone, message: payload.application.message || '', consent: false }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取代理资料');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user.id]);

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
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await readApiJson(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || '操作失败');
      setNotice(successMessage);
      await load();
      return payload;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const apply = async () => {
    await submit({ action: 'apply', ...form }, '申请已提交。请点击下方“WhatsApp 联系客服”与客服沟通，本页面会自动更新审核状态。');
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(`${label}已复制`);
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
      anchor.download = `推广二维码-${data.agent.referralCode}.png`;
      anchor.click();
      setNotice('推广二维码已下载');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError('二维码生成失败，请稍后重试');
    };
    image.src = url;
  };

  if (loading && !data) return <div className={card}>正在读取代理资料…</div>;
  if (!data) return <Feedback error={error} notice={notice} />;

  if (data.agent) {
    return (
      <section className="space-y-4">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#2B2B2B] p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E7C996]">代理中心</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-bold">{data.agent.agentNo}</h3><p className="mt-1 text-xs text-white/50">状态：{labelAgentStatus(data.agent.status)}</p></div>
            <span className="rounded-full bg-[#C7A46A]/20 px-3 py-1 text-xs font-bold text-[#E7C996]">{data.agent.commissionRate == null ? '默认佣金' : `${data.agent.commissionRate}%`}</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric label="待确认" value={`RM ${data.summary.pending.toFixed(2)}`} dark />
            <Metric label="可提现" value={`RM ${data.summary.available.toFixed(2)}`} dark />
            <Metric label="已结算" value={`RM ${data.summary.paid.toFixed(2)}`} dark />
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center gap-3"><Handshake className="text-[#A78345]" size={20} /><h3 className="font-bold">专属推广工具</h3></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs text-stone-400">推广码</p><p className="mt-1 font-mono text-lg font-black tracking-wider text-[#A78345]">{data.agent.referralCode}</p>
              <p className="mt-3 break-all text-xs leading-5 text-stone-500">{data.agent.referralUrl}</p>
            </div>
            <div ref={qrCodeRef} className="mx-auto rounded-2xl border border-stone-100 bg-white p-3 shadow-sm sm:mx-0">
              <QRCodeSVG value={data.agent.referralUrl} size={136} level="M" includeMargin aria-label="专属推广链接二维码" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => copyText(data.agent!.referralCode, '推广码')} className="flex items-center justify-center gap-2 rounded-full border border-stone-200 py-3 text-xs font-bold"><Copy size={15} />复制推广码</button>
            <button type="button" onClick={() => copyText(data.agent!.referralUrl, '推广链接')} className="flex items-center justify-center gap-2 rounded-full bg-[#C7A46A] py-3 text-xs font-bold text-white"><ExternalLink size={15} />复制推广链接</button>
            <button type="button" onClick={downloadQrCode} className="flex items-center justify-center gap-2 rounded-full border border-stone-200 py-3 text-xs font-bold"><Download size={15} />下载二维码</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3"><Metric label="推广客户" value={String(data.summary.referrals)} icon={<Users size={18} />} /><Metric label="推广订单" value={String(data.summary.orders)} icon={<BadgeDollarSign size={18} />} /></div>

        <div className={card}>
          <h3 className="font-bold">申请提现</h3>
          <p className="mt-1 text-xs text-stone-400">最低 RM 10，提交后由后台审核付款。</p>
          <div className="mt-4 grid gap-2"><input value={payoutAmount} onChange={event => setPayoutAmount(event.target.value)} inputMode="decimal" placeholder="提现金额" className={inputClass} /><input value={payoutForm.bankName} onChange={event => setPayoutForm(current => ({ ...current, bankName: event.target.value }))} placeholder="银行名称" className={inputClass} /><input value={payoutForm.accountName} onChange={event => setPayoutForm(current => ({ ...current, accountName: event.target.value }))} placeholder="收款人姓名" className={inputClass} /><input value={payoutForm.accountNumber} onChange={event => setPayoutForm(current => ({ ...current, accountNumber: event.target.value }))} placeholder="银行账号" className={inputClass} /><button type="button" disabled={submitting || !payoutForm.bankName || !payoutForm.accountName || !payoutForm.accountNumber} onClick={() => submit({ action: 'request_payout', amount: payoutAmount, paymentMethod: 'bank', paymentDetails: payoutForm }, '提现申请已提交')} className="rounded-2xl bg-[#2D2D2D] py-3 text-sm font-bold text-white disabled:opacity-50">提交提现申请</button></div>
        </div>

        <div className={card}>
          <h3 className="font-bold">佣金明细</h3>
          <div className="mt-3 divide-y divide-stone-100">
            {data.commissions.length ? data.commissions.map(row => <div key={row.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{row.note || labelEntryType(row.type)}</p><p className="mt-1 text-[11px] text-stone-400">{new Date(row.createdAt).toLocaleString()}</p></div><div className="text-right"><p className={`font-bold ${row.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{row.amount >= 0 ? '+' : ''}RM {row.amount.toFixed(2)}</p><p className="mt-1 text-[11px] text-stone-400">{labelLedgerStatus(row.status)}</p></div></div>) : <p className="py-6 text-center text-sm text-stone-400">暂无佣金记录</p>}
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
        <div className={card}>
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-[#A78345]" size={22} /><div><h3 className="font-bold">代理申请：{labelApplicationStatus(application.status)}</h3><p className="mt-1 font-mono text-xs text-stone-400">{application.applicationNo}</p></div></div>
          {application.reviewNote && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">审核说明：{application.reviewNote}</div>}
          {['pending', 'changes_requested'].includes(application.status) && <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600"><p className="font-bold text-stone-800">下一步：联系客户服务</p><p className="mt-1">请点击下方 WhatsApp 按钮，向客服提供申请编号并说明您的推广渠道。审核通过后，本页面会自动显示代理码输入框，无需手动刷新。</p></div>}
          {application.status === 'approved' && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"><p className="font-bold">审核已通过</p><p className="mt-1">请联系客服获取 8 位一次性代理码，并在下方输入完成激活。</p></div>}
          {data.whatsappUrl && <a href={data.whatsappUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white"><Send size={16} />WhatsApp 联系客服</a>}
        </div>
        {application.status === 'approved' && <div className={card}><div className="flex items-center gap-2"><KeyRound size={20} className="text-[#A78345]" /><h3 className="font-bold">激活代理身份</h3></div><p className="mt-2 text-xs leading-5 text-stone-500">输入客服发送的8位一次性代理码。代理码与当前登录手机号绑定。</p><input value={activationCode} onChange={event => setActivationCode(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder="8位一次性代理码" className={`mt-4 ${inputClass} text-center font-mono tracking-[0.3em]`} /><button type="button" disabled={submitting || activationCode.length !== 8} onClick={() => submit({ action: 'activate', activationCode }, '代理身份已激活')} className="mt-3 w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white disabled:opacity-50">立即激活</button></div>}
        {application.status === 'rejected' && !showReapply && <button type="button" onClick={() => setShowReapply(true)} className="w-full rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white">重新申请</button>}
        {(application.status === 'changes_requested' || (application.status === 'rejected' && showReapply)) && (
          <div className={`${card} space-y-3`}>
            <h3 className="font-bold">{application.status === 'changes_requested' ? '补充申请资料' : '重新提交申请'}</h3>
            <Field label="姓名" value={form.fullName} onChange={value => setForm(current => ({ ...current, fullName: value }))} />
            <Field label="所在地区" value={form.region} onChange={value => setForm(current => ({ ...current, region: value }))} />
            <Field label="推广渠道" value={form.promotionChannel} onChange={value => setForm(current => ({ ...current, promotionChannel: value }))} />
            <Field label="WhatsApp 手机号" value={form.whatsappPhone} onChange={value => setForm(current => ({ ...current, whatsappPhone: value }))} />
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-stone-400">申请说明</span><textarea value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} rows={3} className={inputClass} /></label>
            <label className="flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-stone-600"><input type="checkbox" checked={form.consent} onChange={event => setForm(current => ({ ...current, consent: event.target.checked }))} className="mt-1" /><span>我确认补充资料真实，并同意代理规则及隐私说明。</span></label>
            <button type="button" disabled={submitting || !form.consent} onClick={apply} className="w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white disabled:opacity-50">提交审核</button>
          </div>
        )}
        <Feedback error={error} notice={notice} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className={card}><div className="flex items-center gap-3"><Handshake size={22} className="text-[#A78345]" /><div><h3 className="font-bold">申请成为代理</h3><p className="mt-1 text-xs leading-5 text-stone-500">审核通过后可获得专属推广码并赚取订单佣金。</p></div></div></div>
      <div className={`${card} space-y-3`}>
        <Field label="姓名" value={form.fullName} onChange={value => setForm(current => ({ ...current, fullName: value }))} />
        <Field label="所在地区" value={form.region} onChange={value => setForm(current => ({ ...current, region: value }))} />
        <Field label="推广渠道" value={form.promotionChannel} placeholder="例如：社群、门店、Facebook" onChange={value => setForm(current => ({ ...current, promotionChannel: value }))} />
        <Field label="WhatsApp 手机号" value={form.whatsappPhone} onChange={value => setForm(current => ({ ...current, whatsappPhone: value }))} />
        <label className="block"><span className="mb-1 block text-[11px] font-bold text-stone-400">申请说明（选填）</span><textarea value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} rows={3} className={inputClass} /></label>
        <label className="flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-stone-600"><input type="checkbox" checked={form.consent} onChange={event => setForm(current => ({ ...current, consent: event.target.checked }))} className="mt-1" /><span>我确认资料真实，并同意代理规则、佣金结算及隐私说明。</span></label>
        <button type="button" disabled={submitting || !form.consent} onClick={apply} className="w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white disabled:opacity-50">提交代理申请</button>
      </div>
      <Feedback error={error} notice={notice} />
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-bold text-stone-400">{label}</span><input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className={inputClass} /></label>;
}

function Metric({ label, value, dark, icon }: { label: string; value: string; dark?: boolean; icon?: React.ReactNode }) {
  return <div className={`rounded-2xl p-3 ${dark ? 'bg-white/8' : 'border border-stone-100 bg-white shadow-sm'}`}><div className="flex items-center gap-2">{icon}<p className={`text-[11px] ${dark ? 'text-white/45' : 'text-stone-400'}`}>{label}</p></div><p className={`mt-1 font-bold ${dark ? 'text-[#E7C996]' : 'text-[#A78345]'}`}>{value}</p></div>;
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  return <div role="status" className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>;
}

function labelApplicationStatus(status: string) { return ({ pending: '审核中', changes_requested: '需要补充资料', approved: '审核已通过', rejected: '申请未通过', activated: '已激活' } as Record<string, string>)[status] || status; }
function labelAgentStatus(status: string) { return ({ active: '正常', suspended: '已暂停', terminated: '已终止' } as Record<string, string>)[status] || status; }
function labelLedgerStatus(status: string) { return ({ pending: '待确认', available: '可提现', paid: '已结算', voided: '已作废' } as Record<string, string>)[status] || status; }
function labelEntryType(type: string) { return ({ commission: '订单佣金', adjustment: '佣金调整', reversal: '佣金冲正', payout: '代理提现' } as Record<string, string>)[type] || type; }

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
