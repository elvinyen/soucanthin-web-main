import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, MapPin, Phone, RefreshCw, X } from 'lucide-react';

type DeliveryApproval = {
  id: string;
  requestNo: string;
  status: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  distanceKm: number;
  durationMin: number;
  subtotal: number;
  approvedDeliveryFee?: number | null;
  deliveryProvider?: string | null;
  estimatedDeliveryMin?: number | null;
  customerNote?: string | null;
  reviewNote?: string | null;
  reviewedByName?: string | null;
  createdAt: string;
};

type Props = { api: <T,>(path: string, init?: RequestInit) => Promise<T> };

const filters = [
  ['pending', '待处理'],
  ['approved', '已批准'],
  ['rejected', '已拒绝'],
  ['all', '全部'],
] as const;

export function DeliveryApprovalPanel({ api }: Props) {
  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState<DeliveryApproval[]>([]);
  const [selected, setSelected] = useState<DeliveryApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const payload = await api<{ success: true; requests: DeliveryApproval[] }>(`/api/admin/delivery-approvals?status=${status}`);
      setRequests(payload.requests || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '配送申请加载失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [status]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${status === value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-500 hover:bg-white">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />刷新
        </button>
      </div>

      {error && <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle size={16} />{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1.1fr_1fr_2fr_0.8fr_0.9fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
          <span>申请</span><span>顾客</span><span>配送地址</span><span>距离 / 商品</span><span>提交时间</span><span className="text-right">处理</span>
        </div>

        {requests.map(request => (
          <div key={request.id} className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 hover:bg-slate-50/70 md:grid-cols-[1.1fr_1fr_2fr_0.8fr_0.9fr_0.8fr] md:items-center md:gap-4">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-black text-slate-900">{request.requestNo}</p>
              <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(request.status)}`}>{statusLabel(request.status)}</span>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{request.customerName}</p>
              <a href={`tel:${request.customerPhone}`} className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-blue-600"><Phone size={12} />{request.customerPhone}</a>
            </div>

            <div className="flex min-w-0 items-start gap-2 text-xs leading-5 text-slate-600">
              <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0"><p className="line-clamp-2">{request.address}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{request.branchName}</p></div>
            </div>

            <div className="text-xs">
              <p className="font-bold text-slate-800">{request.distanceKm.toFixed(1)} km</p>
              <p className="mt-1 text-slate-500">RM {request.subtotal.toFixed(2)}</p>
            </div>

            <div className="text-xs text-slate-600">
              <p>{formatDate(request.createdAt)}</p>
              <p className="mt-1 text-[11px] text-slate-400">路线约 {request.durationMin} 分钟</p>
            </div>

            <div className="md:text-right">
              {request.status === 'pending' ? (
                <button type="button" onClick={() => setSelected(request)} className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-slate-800">审核</button>
              ) : (
                <div className="text-xs text-slate-500">
                  {request.status === 'approved' && <p className="font-bold text-emerald-700">RM {Number(request.approvedDeliveryFee || 0).toFixed(2)}</p>}
                  <p className="mt-1 truncate text-[10px]">{request.reviewedByName || request.reviewNote || '—'}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {!loading && requests.length === 0 && <div className="grid min-h-48 place-items-center text-sm font-bold text-slate-400">当前没有配送申请</div>}
        {loading && requests.length === 0 && <div className="grid min-h-48 place-items-center text-sm font-bold text-slate-400"><RefreshCw size={18} className="animate-spin" /></div>}
      </div>

      {selected && <ReviewSheet request={selected} api={api} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await load(true); }} />}
    </div>
  );
}

function ReviewSheet({ request, api, onClose, onSaved }: { request: DeliveryApproval; api: Props['api']; onClose: () => void; onSaved: () => Promise<void> }) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [deliveryProvider, setDeliveryProvider] = useState('lalamove');
  const [estimatedDeliveryMin, setEstimatedDeliveryMin] = useState(String(Math.max(request.durationMin + 15, 30)));
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/api/admin/delivery-approvals', {
        method: 'PATCH',
        body: JSON.stringify({ id: request.id, action, deliveryFee, deliveryProvider, estimatedDeliveryMin: Number(estimatedDeliveryMin), reviewNote }),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="配送申请审核">
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[28px] bg-[#F8FAFC] shadow-2xl sm:inset-y-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-xl sm:rounded-none sm:border-l sm:border-slate-800/10">
        <header className="flex shrink-0 items-start justify-between bg-slate-950 px-5 py-5 text-white sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C7A46A]">超范围配送申请</p>
            <h3 className="mt-1.5 font-mono text-lg font-black text-white">{request.requestNo}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭审核窗口" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-slate-300 transition hover:bg-white/15 hover:text-white"><X size={18} /></button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <section>
              <h4 className="text-xs font-black text-slate-500">申请信息</h4>
              <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <InfoRow label="顾客" value={`${request.customerName} · ${request.customerPhone}`} />
                <InfoRow label="配送地址" value={request.address} />
                <InfoRow label="路线" value={`${request.branchName} → ${request.distanceKm.toFixed(1)}km · 约${request.durationMin}分钟`} />
                <InfoRow label="商品金额" value={`RM ${request.subtotal.toFixed(2)}`} />
                {request.customerNote && <InfoRow label="顾客备注" value={request.customerNote} highlight />}
              </div>
            </section>

            <section className="mt-6">
              <h4 className="text-xs font-black text-slate-500">处理结果</h4>
              <div className="mt-3 grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <button type="button" onClick={() => setAction('approve')} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${action === 'approve' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Check size={16} />批准配送</button>
                <button type="button" onClick={() => setAction('reject')} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${action === 'reject' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><X size={16} />拒绝申请</button>
              </div>

              {error && <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle size={16} />{error}</p>}

              <div className="mt-4 grid gap-4">
                {action === 'approve' ? (
                  <>
                    <Field label="配送方式">
                      <select value={deliveryProvider} onChange={event => setDeliveryProvider(event.target.value)} className={inputClass}>
                        <option value="lalamove">Lalamove</option>
                        <option value="grab">Grab</option>
                        <option value="in_house">店内配送</option>
                        <option value="other">其他</option>
                      </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="配送费（RM）">
                        <input required type="number" min="0.01" max="1000" step="0.01" value={deliveryFee} onChange={event => setDeliveryFee(event.target.value)} className={inputClass} placeholder="0.00" />
                      </Field>
                      <Field label="预计送达（分钟）">
                        <input required type="number" min="10" max="480" value={estimatedDeliveryMin} onChange={event => setEstimatedDeliveryMin(event.target.value)} className={inputClass} />
                      </Field>
                    </div>
                    <Field label="客服备注（选填）">
                      <textarea maxLength={500} value={reviewNote} onChange={event => setReviewNote(event.target.value)} className={`${inputClass} min-h-24 resize-none py-3`} placeholder="例如：已与顾客确认配送费" />
                    </Field>
                  </>
                ) : (
                  <Field label="拒绝原因">
                    <textarea required maxLength={500} value={reviewNote} onChange={event => setReviewNote(event.target.value)} className={`${inputClass} min-h-28 resize-none py-3`} placeholder="请填写顾客可看到的拒绝原因" />
                  </Field>
                )}
              </div>
            </section>
          </div>

          <footer className="grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-3 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
            <button disabled={saving} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition ${action === 'approve' ? 'bg-slate-950 hover:bg-slate-800' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>
              {saving ? <RefreshCw size={16} className="animate-spin" /> : action === 'approve' ? <Check size={16} /> : <X size={16} />}
              {saving ? '提交中…' : action === 'approve' ? '确认批准' : '确认拒绝'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="grid grid-cols-[76px_1fr] gap-3 px-3.5 py-3 text-xs"><span className="font-bold text-slate-400">{label}</span><span className={highlight ? 'font-medium text-amber-700' : 'text-slate-700'}>{value}</span></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#C7A46A] focus:ring-2 focus:ring-[#C7A46A]/15';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function statusLabel(status: string) {
  return ({ pending: '待处理', approved: '已批准', rejected: '已拒绝', cancelled: '已取消', expired: '已过期', consumed: '已下单' } as Record<string, string>)[status] || status;
}

function statusClass(status: string) {
  return ({
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
    expired: 'bg-slate-100 text-slate-500',
    consumed: 'bg-blue-50 text-blue-700',
  } as Record<string, string>)[status] || 'bg-slate-100 text-slate-600';
}
