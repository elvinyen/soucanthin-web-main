import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  Truck,
  X,
} from 'lucide-react';
import { DeliveryApprovalPanel } from './DeliveryApprovalPanel';

type DeliveryProvider = 'in_house' | 'grab' | 'lalamove' | 'other';
type DeliveryTaskStatus = 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
type DeliveryTab = 'unassigned' | 'assigned' | 'delivering' | 'delivered';

type DeliveryTask = {
  id: string;
  order_id: string;
  provider: DeliveryProvider;
  rider_name?: string | null;
  rider_phone?: string | null;
  external_order_no?: string | null;
  status: DeliveryTaskStatus;
  estimated_pickup_at?: string | null;
  estimated_delivery_at?: string | null;
  assigned_at: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  actual_delivery_cost: number;
  assigned_by_name?: string | null;
  notes?: string | null;
};

type DeliveryOrder = {
  id: string;
  order_no: string;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string | null;
  assigned_branch_name?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_distance_km?: number | null;
  delivery_duration_min?: number | null;
  delivery_fee?: number | null;
  payable_total?: number | null;
  total: number;
  note?: string | null;
  status: 'kitchen_done' | 'delivering' | 'delivered' | 'completed';
  created_at: string;
  kitchen_completed_at?: string | null;
  last_status_changed_at?: string | null;
  items: {
    id?: string;
    item_code?: string | null;
    name: string;
    quantity: number;
    item_note?: string | null;
  }[];
  deliveryTask?: DeliveryTask | null;
};

type AssignmentForm = {
  provider: DeliveryProvider;
  riderName: string;
  riderPhone: string;
  externalOrderNo: string;
  estimatedPickupAt: string;
  estimatedDeliveryAt: string;
  actualDeliveryCost: string;
  notes: string;
};

type DeliveryBoardProps = {
  api: <T,>(path: string, init?: RequestInit) => Promise<T>;
};

const tabs: { id: DeliveryTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'unassigned', label: '待安排', icon: Clock3 },
  { id: 'assigned', label: '待取餐', icon: PackageCheck },
  { id: 'delivering', label: '配送中', icon: Bike },
  { id: 'delivered', label: '已送达', icon: CheckCircle2 },
];

const emptyAssignment: AssignmentForm = {
  provider: 'in_house',
  riderName: '',
  riderPhone: '',
  externalOrderNo: '',
  estimatedPickupAt: '',
  estimatedDeliveryAt: '',
  actualDeliveryCost: '',
  notes: '',
};

export function DeliveryBoard({ api }: DeliveryBoardProps) {
  const [boardMode, setBoardMode] = useState<'orders' | 'approvals'>('orders');
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [activeTab, setActiveTab] = useState<DeliveryTab>('unassigned');
  const [assignmentOrder, setAssignmentOrder] = useState<DeliveryOrder | null>(null);
  const [form, setForm] = useState<AssignmentForm>(emptyAssignment);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const payload = await api<{ success: true; orders: DeliveryOrder[]; syncedAt?: string }>('/api/admin/delivery');
      setOrders(payload.orders || []);
      setLastSyncAt(payload.syncedAt ? new Date(payload.syncedAt) : new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '配送订单加载失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
    const interval = window.setInterval(() => void loadOrders(true), 5000);
    return () => window.clearInterval(interval);
  }, []);

  const groupedOrders = {
    unassigned: orders.filter(order => order.status === 'kitchen_done' && !isAssignedTask(order.deliveryTask)),
    assigned: orders.filter(order => order.status === 'kitchen_done' && isAssignedTask(order.deliveryTask)),
    delivering: orders.filter(order => order.status === 'delivering'),
    delivered: orders.filter(order => order.status === 'delivered' || order.status === 'completed').slice(0, 20),
  } satisfies Record<DeliveryTab, DeliveryOrder[]>;

  const openAssignment = (order: DeliveryOrder) => {
    const task = order.deliveryTask;
    const pickup = task?.estimated_pickup_at || new Date(Date.now() + 10 * 60_000).toISOString();
    const deliveryMinutes = Math.max(Number(order.delivery_duration_min || 30), 10) + 10;
    const delivery = task?.estimated_delivery_at || new Date(Date.now() + deliveryMinutes * 60_000).toISOString();
    setForm({
      provider: task?.provider || 'in_house',
      riderName: task?.rider_name || '',
      riderPhone: task?.rider_phone || '',
      externalOrderNo: task?.external_order_no || '',
      estimatedPickupAt: toLocalDateTimeInput(pickup),
      estimatedDeliveryAt: toLocalDateTimeInput(delivery),
      actualDeliveryCost: task?.actual_delivery_cost ? String(task.actual_delivery_cost) : '',
      notes: task?.notes || '',
    });
    setFormError('');
    setAssignmentOrder(order);
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignmentOrder) return;
    setActionOrderId(assignmentOrder.id);
    setFormError('');
    try {
      await api('/api/admin/delivery', {
        method: 'POST',
        body: JSON.stringify({
          action: 'assign',
          orderId: assignmentOrder.id,
          ...form,
          estimatedPickupAt: localDateTimeToIso(form.estimatedPickupAt),
          estimatedDeliveryAt: localDateTimeToIso(form.estimatedDeliveryAt),
        }),
      });
      setAssignmentOrder(null);
      await loadOrders(true);
      setActiveTab('assigned');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '配送安排保存失败');
    } finally {
      setActionOrderId(null);
    }
  };

  const runAction = async (order: DeliveryOrder, action: 'start' | 'deliver') => {
    setActionOrderId(order.id);
    setError('');
    try {
      await api('/api/admin/delivery', {
        method: 'PATCH',
        body: JSON.stringify({ action, orderId: order.id }),
      });
      await loadOrders(true);
      setActiveTab(action === 'start' ? 'delivering' : 'delivered');
    } catch (err) {
      setError(err instanceof Error ? err.message : '配送状态更新失败');
    } finally {
      setActionOrderId(null);
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 inline-flex shrink-0 self-start rounded-xl border border-slate-200 bg-white p-1">
        <button type="button" onClick={() => setBoardMode('orders')} className={`rounded-lg px-4 py-2 text-xs font-black ${boardMode === 'orders' ? 'bg-slate-950 text-white' : 'text-slate-500'}`}>配送订单</button>
        <button type="button" onClick={() => setBoardMode('approvals')} className={`rounded-lg px-4 py-2 text-xs font-black ${boardMode === 'approvals' ? 'bg-slate-950 text-white' : 'text-slate-500'}`}>超范围申请</button>
      </div>
      {boardMode === 'approvals' ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-none"><DeliveryApprovalPanel api={api} /></div> : <>
      <div className="mb-3 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const count = groupedOrders[tab.id].length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-20 items-center justify-between rounded-2xl border p-3 text-left transition lg:cursor-default ${activeTab === tab.id ? 'border-slate-950 bg-slate-950 text-white lg:border-slate-200 lg:bg-white lg:text-slate-950' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              <span>
                <span className="block text-xs font-bold">{tab.label}</span>
                <span className="mt-1 block text-2xl font-black">{count}</span>
              </span>
              <Icon size={21} className={activeTab === tab.id ? 'text-amber-300 lg:text-slate-400' : 'text-slate-400'} />
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <span>{lastSyncAt ? `最后同步 ${lastSyncAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '正在同步配送订单'}</span>
        <button type="button" onClick={() => void loadOrders()} className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-950">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新
        </button>
      </div>

      {error && (
        <div className="mb-3 flex shrink-0 items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
      <div className="lg:hidden">
        <DeliveryColumn
          tab={activeTab}
          orders={groupedOrders[activeTab]}
          actionOrderId={actionOrderId}
          onAssign={openAssignment}
          onStart={order => void runAction(order, 'start')}
          onDeliver={order => void runAction(order, 'deliver')}
        />
      </div>

      <div className="hidden min-w-0 gap-3 lg:grid lg:grid-cols-2 2xl:grid-cols-4">
        {tabs.map(tab => (
          <React.Fragment key={tab.id}>
            <DeliveryColumn
              tab={tab.id}
              orders={groupedOrders[tab.id]}
              actionOrderId={actionOrderId}
              onAssign={openAssignment}
              onStart={order => void runAction(order, 'start')}
              onDeliver={order => void runAction(order, 'deliver')}
            />
          </React.Fragment>
        ))}
      </div>
      </div>

      {assignmentOrder && (
        <AssignmentSheet
          order={assignmentOrder}
          form={form}
          setForm={setForm}
          error={formError}
          saving={actionOrderId === assignmentOrder.id}
          onSubmit={saveAssignment}
          onClose={() => setAssignmentOrder(null)}
        />
      )}
      </>}
    </section>
  );
}

function DeliveryColumn({ tab, orders, actionOrderId, onAssign, onStart, onDeliver }: {
  tab: DeliveryTab;
  orders: DeliveryOrder[];
  actionOrderId: string | null;
  onAssign: (order: DeliveryOrder) => void;
  onStart: (order: DeliveryOrder) => void;
  onDeliver: (order: DeliveryOrder) => void;
}) {
  const tabConfig = tabs.find(item => item.id === tab) || tabs[0];
  const Icon = tabConfig.icon;
  return (
    <div className="min-w-0 rounded-[20px] border border-slate-200 bg-slate-100/70 p-2.5">
      <div className="flex items-center justify-between px-1.5 py-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Icon size={17} />{tabConfig.label}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500">{orders.length}</span>
      </div>
      <div className="grid gap-2.5">
        {orders.map(order => (
          <React.Fragment key={order.id}>
            <DeliveryCard
              order={order}
              tab={tab}
              busy={actionOrderId === order.id}
              onAssign={() => onAssign(order)}
              onStart={() => onStart(order)}
              onDeliver={() => onDeliver(order)}
            />
          </React.Fragment>
        ))}
        {!orders.length && (
          <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 text-center text-sm font-bold text-slate-400">
            当前没有{tabConfig.label}订单
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryCard({ order, tab, busy, onAssign, onStart, onDeliver }: {
  order: DeliveryOrder;
  tab: DeliveryTab;
  busy: boolean;
  onAssign: () => void;
  onStart: () => void;
  onDeliver: () => void;
}) {
  const task = order.deliveryTask;
  const warning = getDeliveryWarning(order, tab);
  const mapUrl = buildMapUrl(order);
  return (
    <article className={`rounded-2xl border bg-white p-3.5 shadow-sm ${warning.tone === 'red' ? 'border-red-200' : warning.tone === 'orange' ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-black text-slate-950">{order.order_no}</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-700">{order.customer_name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${warning.tone === 'red' ? 'bg-red-100 text-red-700' : warning.tone === 'orange' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          {warning.label}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600">
        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 font-bold text-slate-700 hover:text-blue-600"><Phone size={14} />{order.customer_phone}</a>
        <a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 leading-5 hover:text-blue-600">
          <MapPin size={14} className="mt-0.5 shrink-0" /><span>{order.delivery_address || '未填写地址'}</span><ExternalLink size={12} className="mt-1 shrink-0" />
        </a>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
        <p className="font-bold text-slate-800">{order.items.map(item => `${item.item_code ? `[${item.item_code}] ` : ''}${item.name} ×${item.quantity}`).join(' · ') || '无菜品资料'}</p>
        <p className="mt-1">{order.assigned_branch_name || '未分配门店'} · {formatNumber(order.delivery_distance_km, 2)} km · 约 {formatNumber(order.delivery_duration_min, 0)} 分钟</p>
        {order.note && <p className="mt-1 text-amber-700">备注：{order.note}</p>}
      </div>

      {task && (
        <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <p className="flex items-center gap-2 font-bold text-slate-800"><Truck size={14} />{providerLabel(task.provider)}{task.rider_name ? ` · ${task.rider_name}` : ''}</p>
          {task.rider_phone && <a href={`tel:${task.rider_phone}`} className="mt-1.5 flex items-center gap-2 hover:text-blue-600"><Phone size={13} />{task.rider_phone}</a>}
          {task.external_order_no && <p className="mt-1.5">配送单号：{task.external_order_no}</p>}
          {task.estimated_delivery_at && <p className="mt-1.5">预计送达：{formatTime(task.estimated_delivery_at)}</p>}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {tab === 'unassigned' && <ActionButton onClick={onAssign} disabled={busy} icon={Bike}>安排配送</ActionButton>}
        {tab === 'assigned' && (
          <>
            <button type="button" onClick={onAssign} disabled={busy} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="修改配送安排"><Pencil size={15} /></button>
            <ActionButton onClick={onStart} disabled={busy} icon={PackageCheck}>骑手已取餐</ActionButton>
          </>
        )}
        {tab === 'delivering' && <ActionButton onClick={onDeliver} disabled={busy} icon={CheckCircle2}>确认送达</ActionButton>}
        {tab === 'delivered' && <p className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-xs font-black text-emerald-700"><CheckCircle2 size={15} />配送完成</p>}
      </div>
    </article>
  );
}

function ActionButton({ onClick, disabled, icon: Icon, children }: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50">
      {disabled ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}{children}
    </button>
  );
}

function AssignmentSheet({ order, form, setForm, error, saving, onSubmit, onClose }: {
  order: DeliveryOrder;
  form: AssignmentForm;
  setForm: React.Dispatch<React.SetStateAction<AssignmentForm>>;
  error: string;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const update = (key: keyof AssignmentForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm">
      <aside role="dialog" aria-modal="true" aria-labelledby="delivery-assignment-title" className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:w-full sm:max-w-lg sm:rounded-none">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs font-bold text-slate-400">安排配送</p>
            <h3 id="delivery-assignment-title" className="mt-1 font-mono text-xl font-black text-slate-950">{order.order_no}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500" aria-label="关闭配送安排"><X size={18} /></button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 p-5">
          <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <p className="font-bold text-slate-950">{order.customer_name} · {order.customer_phone}</p>
            <p className="mt-1">{order.delivery_address}</p>
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
          <Field label="配送方式">
            <select value={form.provider} onChange={event => update('provider', event.target.value)} className={inputClassName}>
              <option value="in_house">店内配送员</option>
              <option value="grab">Grab</option>
              <option value="lalamove">Lalamove</option>
              <option value="other">其他配送</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="配送员姓名"><input value={form.riderName} onChange={event => update('riderName', event.target.value)} className={inputClassName} placeholder="店员或骑手姓名" required={form.provider === 'in_house'} /></Field>
            <Field label="配送员电话"><input value={form.riderPhone} onChange={event => update('riderPhone', event.target.value)} className={inputClassName} inputMode="tel" placeholder="可一键拨打" /></Field>
          </div>
          <Field label="第三方配送单号"><input value={form.externalOrderNo} onChange={event => update('externalOrderNo', event.target.value)} className={inputClassName} placeholder="Grab / Lalamove 单号（可选）" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="预计取餐"><input type="datetime-local" value={form.estimatedPickupAt} onChange={event => update('estimatedPickupAt', event.target.value)} className={inputClassName} /></Field>
            <Field label="预计送达"><input type="datetime-local" value={form.estimatedDeliveryAt} onChange={event => update('estimatedDeliveryAt', event.target.value)} className={inputClassName} /></Field>
          </div>
          <Field label="实际配送成本（RM）"><input type="number" min="0" step="0.01" value={form.actualDeliveryCost} onChange={event => update('actualDeliveryCost', event.target.value)} className={inputClassName} placeholder="0.00" /></Field>
          <Field label="配送备注"><textarea value={form.notes} onChange={event => update('notes', event.target.value)} className={`${inputClassName} min-h-24 resize-none`} placeholder="门牌、交接或收款说明" /></Field>
          <button type="submit" disabled={saving} className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50">
            {saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}保存配送安排
          </button>
        </form>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-slate-500"><span>{label}</span>{children}</label>;
}

const inputClassName = 'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white';

function isAssignedTask(task?: DeliveryTask | null) {
  return task?.status === 'assigned';
}

function providerLabel(provider: DeliveryProvider) {
  return { in_house: '店内配送', grab: 'Grab', lalamove: 'Lalamove', other: '其他配送' }[provider];
}

function getDeliveryWarning(order: DeliveryOrder, tab: DeliveryTab) {
  if (tab === 'delivered') return { tone: 'normal' as const, label: order.status === 'completed' ? '已完成' : '已送达' };
  const now = Date.now();
  if (tab === 'unassigned') {
    const minutes = elapsedMinutes(order.kitchen_completed_at || order.last_status_changed_at || order.created_at, now);
    return minutes >= 5 ? { tone: 'red' as const, label: `待安排 ${minutes} 分钟` } : { tone: 'normal' as const, label: `${minutes} 分钟` };
  }
  if (tab === 'assigned') {
    const deadline = order.deliveryTask?.estimated_pickup_at;
    const late = deadline ? now > new Date(deadline).getTime() : elapsedMinutes(order.deliveryTask?.assigned_at || order.created_at, now) >= 10;
    return late ? { tone: 'orange' as const, label: '取餐超时' } : { tone: 'normal' as const, label: '等待取餐' };
  }
  const deadline = order.deliveryTask?.estimated_delivery_at;
  return deadline && now > new Date(deadline).getTime()
    ? { tone: 'red' as const, label: '配送超时' }
    : { tone: 'normal' as const, label: '配送中' };
}

function elapsedMinutes(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / 60_000));
}

function buildMapUrl(order: DeliveryOrder) {
  const lat = Number(order.delivery_latitude);
  const lng = Number(order.delivery_longitude);
  const query = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? `${lat},${lng}` : order.delivery_address || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatNumber(value: number | null | undefined, digits: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toFixed(digits) : '-';
}
