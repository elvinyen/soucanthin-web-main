import React, { useEffect, useState } from 'react';
import { Bike, ChevronDown, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

type Tier = { maxKm: number; fee: number };
type Settings = {
  maxAutoDistanceKm: number;
  lalamoveEnabled: boolean;
  lalamoveMarkupPercent: number;
  quoteLockMinutes: number;
  requestExpiryMinutes: number;
  approvalExpiryMinutes: number;
  fallbackFeeTiers: Tier[];
};

type Props = { api: <T,>(path: string, init?: RequestInit) => Promise<T>; canToggleLalamove?: boolean };

export function DeliverySettingsPanel({ api, canToggleLalamove = false }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { void load(); }, []);
  const load = async () => {
    try {
      const payload = await api<{ success: true; settings: Settings; lalamoveConfigured: boolean }>('/api/admin/delivery-settings');
      setSettings(payload.settings); setConfigured(payload.lalamoveConfigured); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : '配送设置加载失败'); }
  };
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => current ? { ...current, [key]: value } : current);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!settings) return; setSaving(true); setError(''); setNotice('');
    try {
      const payload = await api<{ success: true; settings: Settings; lalamoveConfigured: boolean }>('/api/admin/delivery-settings', { method: 'PATCH', body: JSON.stringify(settings) });
      setSettings(payload.settings); setConfigured(payload.lalamoveConfigured); setNotice('配送设置已保存');
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); } finally { setSaving(false); }
  };
  if (!settings) return <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{error || '正在加载配送设置…'}</div>;
  return (
    <form onSubmit={save} className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-controls="delivery-settings-content"
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Bike size={19} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">配送规则</span><span className="mt-1 block text-xs text-slate-500">20km 内自动报价，超出后由运营助理审批</span></span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-slate-500">
          <span>{open ? '收起' : '展开'}</span>
          <ChevronDown size={17} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open ? <div id="delivery-settings-content" className="grid">
        <div className="overflow-hidden">
          <div className="border-t border-slate-100">
            {error && <p className="mx-5 mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            {notice && <p className="mx-5 mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</p>}
            <div className="grid gap-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField label="自动配送上限 km" value={settings.maxAutoDistanceKm} min={1} max={100} step={0.5} onChange={value => update('maxAutoDistanceKm', value)} />
                <NumberField label="Lalamove加价 %" value={settings.lalamoveMarkupPercent} min={0} max={200} step={1} onChange={value => update('lalamoveMarkupPercent', value)} />
                <NumberField label="报价锁定 分钟" value={settings.quoteLockMinutes} min={5} max={180} step={1} onChange={value => update('quoteLockMinutes', value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField label="申请有效期 分钟" value={settings.requestExpiryMinutes} min={15} max={1440} step={5} onChange={value => update('requestExpiryMinutes', value)} />
                <NumberField label="审批有效期 分钟" value={settings.approvalExpiryMinutes} min={5} max={240} step={5} onChange={value => update('approvalExpiryMinutes', value)} />
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><span><span className="block text-sm font-bold text-slate-800">启用 Lalamove 实时报价</span><span className="mt-1 block text-xs text-slate-500">{configured ? (canToggleLalamove ? '服务器密钥已配置' : '仅管理员可以切换此开关') : '尚未配置 API Key，当前使用备用阶梯价'}</span></span><input type="checkbox" checked={settings.lalamoveEnabled} disabled={!configured || !canToggleLalamove} onChange={event => update('lalamoveEnabled', event.target.checked)} className="h-5 w-5" /></label>
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-slate-600">备用配送费阶梯</span><button type="button" onClick={() => update('fallbackFeeTiers', [...settings.fallbackFeeTiers, { maxKm: settings.maxAutoDistanceKm, fee: 0 }])} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"><Plus size={14} />增加</button></div>
                <div className="grid gap-2">{settings.fallbackFeeTiers.map((tier, index) => <div key={index} className="grid grid-cols-[1fr_1fr_40px] gap-2"><input aria-label={`第${index + 1}阶梯最大距离`} type="number" min="0.1" max="100" step="0.1" value={tier.maxKm} onChange={event => update('fallbackFeeTiers', settings.fallbackFeeTiers.map((item, itemIndex) => itemIndex === index ? { ...item, maxKm: Number(event.target.value) } : item))} className={inputClass} /><input aria-label={`第${index + 1}阶梯配送费`} type="number" min="0" max="1000" step="0.01" value={tier.fee} onChange={event => update('fallbackFeeTiers', settings.fallbackFeeTiers.map((item, itemIndex) => itemIndex === index ? { ...item, fee: Number(event.target.value) } : item))} className={inputClass} /><button type="button" aria-label={`删除第${index + 1}阶梯`} disabled={settings.fallbackFeeTiers.length <= 1} onClick={() => update('fallbackFeeTiers', settings.fallbackFeeTiers.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 place-items-center rounded-xl border border-slate-200 text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></div>)}</div>
                <p className="mt-2 text-[11px] text-slate-400">左侧为该阶梯最大公里数，右侧为顾客配送费 RM；最后一档必须等于自动配送上限。</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 p-5"><button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50">{saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}{saving ? '保存中' : '保存配送设置'}</button></div>
          </div>
        </div>
      </div> : null}
    </form>
  );
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) { return <label><span className="mb-2 block text-xs font-bold text-slate-600">{label}</span><input required type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className={inputClass} /></label>; }
const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white';
