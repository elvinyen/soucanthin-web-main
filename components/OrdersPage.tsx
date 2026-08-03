import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CookingPot,
  CreditCard,
  MapPin,
  PackageCheck,
  ReceiptText,
  Truck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AuthMeResponse, UserOrderSummary } from '../types/auth';
import LanguageSelector from './LanguageSelector';

interface OrdersPageProps {
  session: AuthMeResponse;
  onLogin: () => void;
  onOpenHistory: () => void;
  onStartOrder: () => void;
}

type OrderTab = 'current' | 'history';
type HistoryFilter = 'all' | 'completed' | 'cancelled';
type StepState = 'done' | 'current' | 'upcoming';

const activeStatuses = new Set([
  'pending_confirm',
  'waiting_kitchen',
  'cooking',
  'kitchen_done',
  'preparing',
  'delivering',
  'delivered',
]);

const OrdersPage: React.FC<OrdersPageProps> = ({ session, onLogin, onOpenHistory, onStartOrder }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<OrderTab>('current');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const orders = session.orders || [];

  const currentOrders = useMemo(
    () => orders.filter(order => activeStatuses.has(order.status)),
    [orders],
  );
  const historyOrders = useMemo(
    () => orders.filter(order => !activeStatuses.has(order.status)),
    [orders],
  );
  const filteredHistoryOrders = useMemo(() => {
    if (historyFilter === 'completed') return historyOrders.filter(order => order.status === 'completed');
    if (historyFilter === 'cancelled') return historyOrders.filter(isCancelledOrRefunded);
    return historyOrders;
  }, [historyFilter, historyOrders]);

  const selectTab = (tab: OrderTab) => {
    setActiveTab(tab);
    setExpandedOrderId(null);
    if (tab === 'history') onOpenHistory();
  };

  if (!session.authenticated) {
    return (
      <div className="min-h-screen bg-stone-50 px-6 pb-36">
        <PageHeader title={t('common.orders')} />
        <div className="mt-10 rounded-[2rem] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D2D2D] text-[#C8A97E]">
            <ReceiptText size={24} />
          </div>
          <h2 className="serif mt-5 text-lg font-bold text-[#2D2D2D]">{t('ordersPage.loginTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">{t('ordersPage.loginDescription')}</p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-6 w-full rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white"
          >
            {t('common.login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 px-6 pb-40 text-[#2D2D2D]">
      <PageHeader title={t('common.orders')} />
      <OrderTabs
        activeTab={activeTab}
        currentCount={currentOrders.length}
        onSelect={selectTab}
        t={t}
      />

      {activeTab === 'current' ? (
        <main className="space-y-5 pt-6">
          {currentOrders.length === 0 ? (
            <EmptyState
              title={t('ordersPage.emptyCurrentTitle')}
              description={t('ordersPage.emptyCurrentDescription')}
              actionLabel={t('ordersPage.startOrder')}
              onAction={onStartOrder}
            />
          ) : (
            currentOrders.map(order => (
              <CurrentOrderCard
                key={order.id}
                order={order}
                expanded={expandedOrderId === order.id}
                onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                t={t}
                language={i18n.language}
              />
            ))
          )}
        </main>
      ) : (
        <main className="pt-5">
          <HistoryFilters value={historyFilter} onChange={setHistoryFilter} t={t} />
          <div className="mt-4 space-y-3">
            {filteredHistoryOrders.length === 0 ? (
              <EmptyState
                title={t('ordersPage.emptyHistoryTitle')}
                description={t('ordersPage.emptyHistoryDescription')}
              />
            ) : (
              filteredHistoryOrders.map(order => (
                <HistoryOrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedOrderId === order.id}
                  onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  t={t}
                  language={i18n.language}
                />
              ))
            )}
          </div>
        </main>
      )}
    </div>
  );
};

const PageHeader = ({ title }: { title: string }) => (
  <>
    <header className="fixed left-1/2 top-0 z-[60] flex h-16 w-full max-w-md -translate-x-1/2 items-center justify-between bg-stone-50/95 px-6 shadow-sm backdrop-blur-md">
      <h1 className="serif text-2xl font-bold text-[#2D2D2D]">{title}</h1>
      <LanguageSelector />
    </header>
    <div className="h-16" aria-hidden="true" />
  </>
);

const OrderTabs: React.FC<{
  activeTab: OrderTab;
  currentCount: number;
  onSelect: (tab: OrderTab) => void;
  t: TFunction;
}> = ({ activeTab, currentCount, onSelect, t }) => (
  <>
    <div className="fixed left-1/2 top-16 z-[55] w-full max-w-md -translate-x-1/2 border-b border-stone-200 bg-stone-50/95 px-6 backdrop-blur-md" role="tablist">
      <div className="grid grid-cols-2">
        {(['current', 'history'] as const).map(tab => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onSelect(tab)}
              className={`relative py-4 text-sm font-bold transition-colors ${selected ? 'text-[#2D2D2D]' : 'text-stone-400'}`}
              aria-selected={selected}
              role="tab"
            >
              {tab === 'current' ? t('ordersPage.tabs.current') : t('ordersPage.tabs.history')}
              {tab === 'current' && currentCount > 0 && (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#C8A97E]/15 px-1.5 py-0.5 text-[10px] text-[#A58150]">
                  {currentCount}
                </span>
              )}
              {selected && <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-[#C8A97E]" />}
            </button>
          );
        })}
      </div>
    </div>
    <div className="h-[53px]" aria-hidden="true" />
  </>
);

const HistoryFilters: React.FC<{
  value: HistoryFilter;
  onChange: (filter: HistoryFilter) => void;
  t: TFunction;
}> = ({ value, onChange, t }) => (
  <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t('ordersPage.filters.label')}>
    {(['all', 'completed', 'cancelled'] as const).map(filter => (
      <button
        key={filter}
        type="button"
        onClick={() => onChange(filter)}
        className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
          value === filter
            ? 'bg-[#2D2D2D] text-white shadow-sm'
            : 'border border-stone-200 bg-white text-stone-500'
        }`}
        aria-pressed={value === filter}
      >
        {t(`ordersPage.filters.${filter}`)}
      </button>
    ))}
  </div>
);

const CurrentOrderCard: React.FC<{
  order: UserOrderSummary;
  expanded: boolean;
  onToggle: () => void;
  t: TFunction;
  language: string;
}> = ({ order, expanded, onToggle, t, language }) => {
  const steps = buildSteps(order, t);
  const serviceValue = order.orderType === 'takeaway'
    ? t('ordersPage.takeawayDelivery')
    : order.tableNo || '-';

  return (
    <article className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
      <div className="bg-[#2D2D2D] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-[#C8A97E] px-3 py-1 text-xs font-bold text-white">
              {labelOrderStatus(order.status, t, order.orderType)}
            </span>
            <p className="mt-3 text-sm font-bold leading-6 text-white/90">{currentStatusDescription(order, t)}</p>
            <p className="mt-1 truncate text-[11px] text-white/50">
              {shortOrderNo(order.orderNo)} · {formatDate(order.createdAt, language)}
            </p>
          </div>
          <p className="shrink-0 text-lg font-bold text-[#D7B989]">
            RM {(order.payableTotal ?? order.total).toFixed(2)}
          </p>
        </div>

        <div className="mt-6 flex items-start">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.label}>
                <div className="flex w-12 shrink-0 flex-col items-center text-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${stepClassName(step.state)}`}>
                    {step.state === 'done' ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}
                  </div>
                  <span className={`mt-2 text-[9px] leading-3 ${step.state === 'upcoming' ? 'text-white/35' : 'text-white/80'}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`mt-4 h-px min-w-3 flex-1 ${step.state === 'done' ? 'bg-[#C8A97E]' : 'bg-white/15'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        <p className="text-sm font-bold text-[#2D2D2D]">{itemSummary(order, t)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatusStat icon={CreditCard} label={t('ordersPage.paymentStatus')} value={labelPaymentStatus(order.paymentStatus, t)} />
          <StatusStat
            icon={order.orderType === 'takeaway' ? Truck : MapPin}
            label={order.orderType === 'takeaway' ? t('ordersPage.deliveryMethod') : t('ordersPage.tableLabel')}
            value={serviceValue}
          />
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="mt-4 flex w-full items-center justify-center gap-1 border-t border-stone-100 pt-4 text-xs font-bold text-[#9C7747]"
          aria-expanded={expanded}
        >
          {expanded ? t('ordersPage.hideDetails') : t('ordersPage.viewDetails')}
          <ChevronDown size={15} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && <OrderDetails order={order} t={t} />}
      </div>
    </article>
  );
};

const HistoryOrderCard: React.FC<{
  order: UserOrderSummary;
  expanded: boolean;
  onToggle: () => void;
  t: TFunction;
  language: string;
}> = ({ order, expanded, onToggle, t, language }) => (
  <article className="rounded-[1.5rem] bg-white p-5 shadow-sm">
    <button type="button" onClick={onToggle} className="w-full text-left" aria-expanded={expanded}>
      <div className="flex items-center justify-between gap-4">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${historyStatusClassName(order)}`}>
          {labelOrderStatus(order.status, t, order.orderType)}
        </span>
        <p className="text-base font-bold text-[#B38B56]">RM {(order.payableTotal ?? order.total).toFixed(2)}</p>
      </div>
      <p className="mt-3 truncate text-sm font-bold text-[#2D2D2D]">{itemSummary(order, t)}</p>
      {order.orderType !== 'takeaway' && (
        <span className="mt-2 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">
          {t('ordersPage.dineInTable', { table: order.tableNo || '-' })}
        </span>
      )}
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-stone-500">
        <span>{formatShortDate(order.createdAt, language)} · {shortOrderNo(order.orderNo)}</span>
        <ChevronDown size={17} className={`shrink-0 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
    </button>
    {expanded && <OrderDetails order={order} t={t} />}
  </article>
);

const StatusStat: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl bg-stone-50 p-3">
    <Icon size={17} className="text-[#B38B56]" />
    <p className="mt-2 text-[10px] text-stone-500">{label}</p>
    <p className="mt-1 truncate text-xs font-bold text-[#2D2D2D]">{value}</p>
  </div>
);

const OrderDetails: React.FC<{ order: UserOrderSummary; t: TFunction }> = ({ order, t }) => (
  <div className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-xs text-stone-500">
    {(order.items || []).map(item => (
      <div key={item.id || item.name} className="flex justify-between gap-3">
        <span className="text-[#2D2D2D]">{item.name} ×{item.quantity}</span>
        <span>RM {item.lineTotal.toFixed(2)}</span>
      </div>
    ))}
    <InfoLine label={t('ordersPage.preparationStatus')} value={labelPreparationStatus(order.status, t)} />
    <InfoLine
      label={order.orderType === 'takeaway' ? t('ordersPage.deliveryStatus') : t('ordersPage.tableServiceStatus')}
      value={labelDeliveryStatus(order, t)}
    />
    <InfoLine label={t('ordersPage.paidAmount')} value={`RM ${(order.payableTotal ?? order.total).toFixed(2)}`} strong />
  </div>
);

const InfoLine: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex justify-between gap-4">
    <span className="text-stone-500">{label}</span>
    <span className={`text-right ${strong ? 'font-bold text-[#2D2D2D]' : 'text-stone-700'}`}>{value}</span>
  </div>
);

const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-[2rem] bg-white px-6 py-12 text-center shadow-sm">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#C8A97E]/15 text-[#A58150]">
      <ReceiptText size={21} />
    </div>
    <h2 className="mt-4 text-base font-bold text-[#2D2D2D]">{title}</h2>
    <p className="mt-2 text-sm text-stone-500">{description}</p>
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="mt-6 rounded-full bg-[#2D2D2D] px-6 py-3 text-xs font-bold text-white">
        {actionLabel}
      </button>
    )}
  </div>
);

function buildSteps(order: UserOrderSummary, t: TFunction) {
  const currentIndex = currentStepIndex(order.status);
  const isTakeaway = order.orderType === 'takeaway';
  const definitions = [
    {
      label: order.status === 'pending_confirm' ? t('ordersPage.steps.submitted') : t('ordersPage.steps.confirmed'),
      icon: ReceiptText,
    },
    {
      label: order.status === 'waiting_kitchen' ? t('ordersPage.status.waiting_kitchen') : t('ordersPage.steps.preparing'),
      icon: CookingPot,
    },
    {
      label: isTakeaway
        ? order.status === 'kitchen_done' ? t('ordersPage.steps.waitingDelivery') : t('ordersPage.steps.delivering')
        : order.status === 'delivering' ? t('ordersPage.steps.serving') : t('ordersPage.steps.waitingServing'),
      icon: isTakeaway ? Truck : MapPin,
    },
    { label: isTakeaway ? t('ordersPage.steps.delivered') : t('ordersPage.steps.served'), icon: PackageCheck },
  ];
  return definitions.map((step, index) => ({
    ...step,
    state: (index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming') as StepState,
  }));
}

function currentStepIndex(status?: string) {
  if (status === 'delivered' || status === 'completed') return 3;
  if (status === 'kitchen_done' || status === 'delivering') return 2;
  if (status === 'waiting_kitchen' || status === 'preparing' || status === 'cooking') return 1;
  return 0;
}

function stepClassName(state: StepState) {
  if (state === 'done') return 'border-[#C8A97E] bg-[#C8A97E] text-white';
  if (state === 'current') return 'border-[#D7B989] bg-white text-[#A58150] ring-4 ring-[#C8A97E]/20';
  return 'border-white/15 bg-white/5 text-white/30';
}

function historyStatusClassName(order: UserOrderSummary) {
  if (isCancelledOrRefunded(order)) return 'bg-red-50 text-red-500';
  return 'bg-emerald-50 text-emerald-700';
}

function isCancelledOrRefunded(order: UserOrderSummary) {
  return order.status === 'cancelled'
    || order.status === 'stock_issue'
    || order.paymentStatus?.toLowerCase().includes('refund');
}

function currentStatusDescription(order: UserOrderSummary, t: TFunction) {
  if (order.status === 'kitchen_done') {
    return order.orderType === 'takeaway'
      ? t('ordersPage.currentDescription.readyForDelivery')
      : t('ordersPage.currentDescription.readyForTable');
  }
  if (order.status === 'delivering') {
    return order.orderType === 'takeaway' ? t('ordersPage.delivery.delivering') : t('ordersPage.currentDescription.serving');
  }
  if (order.status === 'delivered') {
    return order.orderType === 'takeaway' ? t('ordersPage.delivery.delivered') : t('ordersPage.currentDescription.served');
  }
  return labelPreparationStatus(order.status, t);
}

function itemSummary(order: UserOrderSummary, t: TFunction) {
  const items = order.items || [];
  if (items.length === 0) return t('ordersPage.itemSummaryUnavailable');
  const first = items[0];
  const remaining = items.length - 1;
  return remaining > 0
    ? t('ordersPage.itemSummaryMore', { name: first.name, quantity: first.quantity, count: remaining })
    : `${first.name} ×${first.quantity}`;
}

function shortOrderNo(orderNo: string) {
  const suffix = orderNo.split('-').pop() || orderNo;
  return `#${suffix}`;
}

function labelOrderStatus(status: string | undefined, t: TFunction, orderType?: string) {
  if (orderType !== 'takeaway') {
    if (status === 'kitchen_done') return t('ordersPage.steps.waitingServing');
    if (status === 'delivering') return t('ordersPage.steps.serving');
    if (status === 'delivered') return t('ordersPage.steps.served');
  }
  return status ? t(`ordersPage.status.${status}`, { defaultValue: status }) : '-';
}

function labelPreparationStatus(status: string | undefined, t: TFunction) {
  if (status === 'preparing' || status === 'cooking' || status === 'waiting_kitchen') return t('ordersPage.prep.preparing');
  if (status === 'kitchen_done' || status === 'delivering' || status === 'delivered' || status === 'completed') return t('ordersPage.prep.ready');
  if (status === 'cancelled' || status === 'stock_issue') return t('ordersPage.prep.cancelled');
  return t('ordersPage.prep.pending');
}

function labelDeliveryStatus(order: UserOrderSummary, t: TFunction) {
  if (order.orderType !== 'takeaway') {
    if (order.status === 'delivered' || order.status === 'completed') return t('ordersPage.delivery.dineinServed');
    if (order.status === 'delivering') return t('ordersPage.delivery.dineinServing');
    if (order.status === 'kitchen_done') return t('ordersPage.delivery.dineinWaitingServing');
    return t('ordersPage.delivery.dineinNotStarted');
  }
  if (order.status === 'delivering') return t('ordersPage.delivery.delivering');
  if (order.status === 'delivered' || order.status === 'completed') return t('ordersPage.delivery.delivered');
  return t('ordersPage.delivery.notStarted');
}

function labelPaymentStatus(status: string | undefined, t: TFunction) {
  return status ? t(`ordersPage.payment.${status}`, { defaultValue: status }) : '-';
}

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

function formatShortDate(value?: string | null, language = 'en') {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(`${language.split('-')[0]}-MY`, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default OrdersPage;
