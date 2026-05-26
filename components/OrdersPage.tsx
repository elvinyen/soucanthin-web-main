import React, { useMemo, useState } from 'react';
import { ChevronRight, CookingPot, CreditCard, MapPin, PackageCheck, ReceiptText, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AuthMeResponse, UserOrderSummary } from '../types/auth';

interface OrdersPageProps {
  session: AuthMeResponse;
  onLogin: () => void;
  onOpenHistory: () => void;
}

const activeStatuses = new Set(['pending_confirm', 'preparing', 'delivering', 'delivered']);

const OrdersPage: React.FC<OrdersPageProps> = ({ session, onLogin, onOpenHistory }) => {
  const { t, i18n } = useTranslation();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const orders = session.orders || [];
  const currentOrder = useMemo(
    () => orders.find(order => activeStatuses.has(order.status)) || orders[0],
    [orders],
  );
  const historyOrders = currentOrder ? orders.filter(order => order.id !== currentOrder.id).slice(0, 3) : orders.slice(0, 3);

  if (!session.authenticated) {
    return (
      <div className="min-h-screen bg-stone-50 px-7 pb-28 pt-8">
        <PageTitle t={t} />
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
    <div className="min-h-screen bg-stone-50 px-6 pb-32 pt-7">
      <PageTitle t={t} />

      {!currentOrder ? (
        <div className="mt-8 rounded-[2rem] bg-white px-6 py-12 text-center text-sm text-stone-400 shadow-sm">
          {t('ordersPage.empty')}
        </div>
      ) : (
        <section className="mt-7 space-y-5">
          <div className="rounded-[2rem] bg-[#2D2D2D] p-6 text-white shadow-xl shadow-black/15">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">{t('ordersPage.currentOrder')}</p>
                <h2 className="serif mt-2 text-xl font-bold">{currentOrder.orderNo}</h2>
                <p className="mt-2 text-xs text-white/50">{formatDate(currentOrder.createdAt, i18n.language)}</p>
              </div>
              <div className="rounded-full bg-[#C8A97E] px-3 py-1 text-xs font-bold text-white">
                {labelOrderStatus(currentOrder.status, t)}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <StatusStat icon={CreditCard} label={t('ordersPage.paymentStatus')} value={labelPaymentStatus(currentOrder.paymentStatus, t)} />
              <StatusStat icon={currentOrder.orderType === 'takeaway' ? Truck : MapPin} label={currentOrder.orderType === 'takeaway' ? t('ordersPage.deliveryMethod') : t('ordersPage.tableLabel')} value={currentOrder.orderType === 'takeaway' ? t('ordersPage.takeawayDelivery') : currentOrder.tableNo || '-'} />
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{t('ordersPage.progress')}</h3>
            <div className="mt-5 space-y-4">
              {buildSteps(currentOrder, t).map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${step.done ? 'bg-[#C8A97E] text-white' : 'bg-stone-100 text-stone-300'}`}>
                        <Icon size={17} />
                      </div>
                      {index < buildSteps(currentOrder, t).length - 1 && <div className={`mt-2 h-7 w-px ${step.done ? 'bg-[#C8A97E]/45' : 'bg-stone-100'}`} />}
                    </div>
                    <div className="pt-1">
                      <p className={`text-sm font-bold ${step.done ? 'text-[#2D2D2D]' : 'text-stone-300'}`}>{step.label}</p>
                      <p className="mt-1 text-xs text-stone-400">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <OrderSummary order={currentOrder} expanded={expandedOrderId === currentOrder.id} onToggle={() => setExpandedOrderId(expandedOrderId === currentOrder.id ? null : currentOrder.id)} t={t} language={i18n.language} />
        </section>
      )}

      <section className="mt-7 space-y-3">
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex w-full items-center justify-between rounded-[1.5rem] bg-white px-5 py-4 text-left shadow-sm"
        >
          <div>
            <p className="text-sm font-bold text-[#2D2D2D]">{t('ordersPage.history')}</p>
            <p className="mt-1 text-xs text-stone-400">{t('ordersPage.historyDescription')}</p>
          </div>
          <ChevronRight className="text-stone-300" size={20} />
        </button>

        {historyOrders.map(order => (
          <OrderSummary
            key={order.id}
            order={order}
            compact
            expanded={expandedOrderId === order.id}
            onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
            t={t}
            language={i18n.language}
          />
        ))}
      </section>
    </div>
  );
};

const PageTitle = ({ t }: { t: TFunction }) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.24em] text-stone-400">Orders</p>
    <h1 className="serif mt-1 text-2xl font-bold text-[#2D2D2D]">{t('common.orders')}</h1>
  </div>
);

const StatusStat: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl bg-white/10 p-3">
    <Icon size={17} className="text-[#C8A97E]" />
    <p className="mt-2 text-[10px] text-white/45">{label}</p>
    <p className="mt-1 font-bold">{value}</p>
  </div>
);

const OrderSummary: React.FC<{ order: UserOrderSummary; expanded: boolean; onToggle: () => void; compact?: boolean; t: TFunction; language: string }> = ({ order, expanded, onToggle, compact, t, language }) => (
  <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 text-left">
      <div>
        <p className="font-mono text-sm font-bold text-[#2D2D2D]">{order.orderNo}</p>
        <p className="mt-1 text-[11px] text-stone-400">{compact ? labelOrderStatus(order.status, t) : formatDate(order.createdAt, language)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-[#C8A97E]">RM {(order.payableTotal ?? order.total).toFixed(2)}</p>
        <p className="mt-1 text-[11px] text-stone-400">{labelPaymentStatus(order.paymentStatus, t)}</p>
      </div>
    </button>
    {expanded && (
      <div className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-xs text-stone-500">
        {(order.items || []).map(item => (
          <div key={item.id || item.name} className="flex justify-between gap-3">
            <span className="text-[#2D2D2D]">{item.name} x{item.quantity}</span>
            <span>RM {item.lineTotal.toFixed(2)}</span>
          </div>
        ))}
        <div className="h-px bg-stone-100" />
        <InfoLine label={t('ordersPage.preparationStatus')} value={labelPreparationStatus(order.status, t)} />
        <InfoLine label={t('ordersPage.deliveryStatus')} value={labelDeliveryStatus(order, t)} />
        <InfoLine label={t('ordersPage.paidAmount')} value={`RM ${(order.payableTotal ?? order.total).toFixed(2)}`} strong />
      </div>
    )}
  </div>
);

const InfoLine: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex justify-between gap-4">
    <span className="text-stone-400">{label}</span>
    <span className={`text-right ${strong ? 'font-bold text-[#2D2D2D]' : 'text-stone-600'}`}>{value}</span>
  </div>
);

function buildSteps(order: UserOrderSummary, t: TFunction) {
  const rank = statusRank(order.status);
  const isTakeaway = order.orderType === 'takeaway';
  return [
    { label: t('ordersPage.steps.submitted'), description: t('ordersPage.steps.submittedDesc'), icon: ReceiptText, done: rank >= 1 },
    { label: t('ordersPage.steps.preparing'), description: t('ordersPage.steps.preparingDesc'), icon: CookingPot, done: rank >= 2 },
    { label: isTakeaway ? t('ordersPage.steps.delivering') : t('ordersPage.steps.pickup'), description: labelDeliveryStatus(order, t), icon: isTakeaway ? Truck : MapPin, done: rank >= 3 },
    { label: t('ordersPage.steps.delivered'), description: t('ordersPage.steps.deliveredDesc'), icon: PackageCheck, done: rank >= 4 },
    { label: t('ordersPage.steps.completed'), description: t('ordersPage.steps.completedDesc'), icon: PackageCheck, done: rank >= 5 },
  ];
}

function statusRank(status?: string) {
  if (status === 'completed') return 5;
  if (status === 'delivered') return 4;
  if (status === 'delivering') return 3;
  if (status === 'preparing') return 2;
  return 1;
}

function labelOrderStatus(status: string | undefined, t: TFunction) {
  return status ? t(`ordersPage.status.${status}`, { defaultValue: status }) : '-';
}

function labelPreparationStatus(status: string | undefined, t: TFunction) {
  if (status === 'preparing') return t('ordersPage.prep.preparing');
  if (status === 'delivering' || status === 'delivered' || status === 'completed') return t('ordersPage.prep.ready');
  if (status === 'cancelled') return t('ordersPage.prep.cancelled');
  return t('ordersPage.prep.pending');
}

function labelDeliveryStatus(order: UserOrderSummary, t: TFunction) {
  if (order.orderType !== 'takeaway') return order.status === 'delivered' || order.status === 'completed' ? t('ordersPage.delivery.dineinDelivered') : t('ordersPage.delivery.dineinNoDelivery');
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

export default OrdersPage;
