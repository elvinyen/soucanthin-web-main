import React, { useMemo, useState } from 'react';
import { ChevronRight, CookingPot, CreditCard, MapPin, PackageCheck, ReceiptText, Truck } from 'lucide-react';
import type { AuthMeResponse, UserOrderSummary } from '../types/auth';

interface OrdersPageProps {
  session: AuthMeResponse;
  onLogin: () => void;
  onOpenHistory: () => void;
}

const activeStatuses = new Set(['pending_confirm', 'preparing', 'delivering', 'delivered']);

const OrdersPage: React.FC<OrdersPageProps> = ({ session, onLogin, onOpenHistory }) => {
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
        <PageTitle />
        <div className="mt-10 rounded-[2rem] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D2D2D] text-[#C8A97E]">
            <ReceiptText size={24} />
          </div>
          <h2 className="serif mt-5 text-lg font-bold text-[#2D2D2D]">登录后查看订单</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">当前订单状态、配送进度和历史订单都会同步到这里。</p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-6 w-full rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white"
          >
            手机号登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 px-6 pb-32 pt-7">
      <PageTitle />

      {!currentOrder ? (
        <div className="mt-8 rounded-[2rem] bg-white px-6 py-12 text-center text-sm text-stone-400 shadow-sm">
          暂无订单
        </div>
      ) : (
        <section className="mt-7 space-y-5">
          <div className="rounded-[2rem] bg-[#2D2D2D] p-6 text-white shadow-xl shadow-black/15">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Current Order</p>
                <h2 className="serif mt-2 text-xl font-bold">{currentOrder.orderNo}</h2>
                <p className="mt-2 text-xs text-white/50">{formatDate(currentOrder.createdAt)}</p>
              </div>
              <div className="rounded-full bg-[#C8A97E] px-3 py-1 text-xs font-bold text-white">
                {labelOrderStatus(currentOrder.status)}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <StatusStat icon={CreditCard} label="付款状态" value={labelPaymentStatus(currentOrder.paymentStatus)} />
              <StatusStat icon={currentOrder.orderType === 'takeaway' ? Truck : MapPin} label={currentOrder.orderType === 'takeaway' ? '配送方式' : '堂食桌号'} value={currentOrder.orderType === 'takeaway' ? '外卖配送' : currentOrder.tableNo || '-'} />
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">订单进度</h3>
            <div className="mt-5 space-y-4">
              {buildSteps(currentOrder).map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${step.done ? 'bg-[#C8A97E] text-white' : 'bg-stone-100 text-stone-300'}`}>
                        <Icon size={17} />
                      </div>
                      {index < buildSteps(currentOrder).length - 1 && <div className={`mt-2 h-7 w-px ${step.done ? 'bg-[#C8A97E]/45' : 'bg-stone-100'}`} />}
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

          <OrderSummary order={currentOrder} expanded={expandedOrderId === currentOrder.id} onToggle={() => setExpandedOrderId(expandedOrderId === currentOrder.id ? null : currentOrder.id)} />
        </section>
      )}

      <section className="mt-7 space-y-3">
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex w-full items-center justify-between rounded-[1.5rem] bg-white px-5 py-4 text-left shadow-sm"
        >
          <div>
            <p className="text-sm font-bold text-[#2D2D2D]">历史订单</p>
            <p className="mt-1 text-xs text-stone-400">查看全部订单记录与明细</p>
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
          />
        ))}
      </section>
    </div>
  );
};

const PageTitle = () => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.24em] text-stone-400">Orders</p>
    <h1 className="serif mt-1 text-2xl font-bold text-[#2D2D2D]">订单</h1>
  </div>
);

const StatusStat: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl bg-white/10 p-3">
    <Icon size={17} className="text-[#C8A97E]" />
    <p className="mt-2 text-[10px] text-white/45">{label}</p>
    <p className="mt-1 font-bold">{value}</p>
  </div>
);

const OrderSummary: React.FC<{ order: UserOrderSummary; expanded: boolean; onToggle: () => void; compact?: boolean }> = ({ order, expanded, onToggle, compact }) => (
  <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 text-left">
      <div>
        <p className="font-mono text-sm font-bold text-[#2D2D2D]">{order.orderNo}</p>
        <p className="mt-1 text-[11px] text-stone-400">{compact ? labelOrderStatus(order.status) : formatDate(order.createdAt)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-[#C8A97E]">RM {(order.payableTotal ?? order.total).toFixed(2)}</p>
        <p className="mt-1 text-[11px] text-stone-400">{labelPaymentStatus(order.paymentStatus)}</p>
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
        <InfoLine label="制作状态" value={labelPreparationStatus(order.status)} />
        <InfoLine label="配送状态" value={labelDeliveryStatus(order)} />
        <InfoLine label="实付" value={`RM ${(order.payableTotal ?? order.total).toFixed(2)}`} strong />
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

function buildSteps(order: UserOrderSummary) {
  const rank = statusRank(order.status);
  const isTakeaway = order.orderType === 'takeaway';
  return [
    { label: '待确认', description: '订单已提交，等待商家确认', icon: ReceiptText, done: rank >= 1 },
    { label: '制作中', description: '商家正在制作您的餐品', icon: CookingPot, done: rank >= 2 },
    { label: isTakeaway ? '配送中' : '待取餐', description: labelDeliveryStatus(order), icon: isTakeaway ? Truck : MapPin, done: rank >= 3 },
    { label: '已送达', description: '订单已送达', icon: PackageCheck, done: rank >= 4 },
    { label: '已完成', description: '订单已完成，感谢支持', icon: PackageCheck, done: rank >= 5 },
  ];
}

function statusRank(status?: string) {
  if (status === 'completed') return 5;
  if (status === 'delivered') return 4;
  if (status === 'delivering') return 3;
  if (status === 'preparing') return 2;
  return 1;
}

function labelOrderStatus(status?: string) {
  const labels: Record<string, string> = {
    pending_confirm: '待确认',
    preparing: '制作中',
    delivering: '配送中',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
  };
  return labels[status || ''] || status || '-';
}

function labelPreparationStatus(status?: string) {
  if (status === 'preparing') return '厨房正在制作';
  if (status === 'delivering' || status === 'delivered' || status === 'completed') return '制作已完成';
  if (status === 'cancelled') return '订单已取消';
  return '订单已提交，等待商家确认';
}

function labelDeliveryStatus(order: UserOrderSummary) {
  if (order.orderType !== 'takeaway') return order.status === 'delivered' || order.status === 'completed' ? '堂食订单已送达' : '堂食无需配送';
  if (order.status === 'delivering') return '订单正在配送中，预计 30-45 分钟送达';
  if (order.status === 'delivered' || order.status === 'completed') return '已送达';
  return '暂未开始配送';
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

export default OrdersPage;
