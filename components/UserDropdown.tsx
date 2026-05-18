import React from 'react';
import { ChevronRight, MapPin, ReceiptText, Settings, TicketPercent, User, Wallet } from 'lucide-react';
import type { AuthMeResponse } from '../types/auth';
import type { UserCenterTab } from './UserCenter';

interface UserDropdownProps {
  isOpen: boolean;
  session: AuthMeResponse;
  onClose: () => void;
  onSelect: (tab: UserCenterTab) => void;
}

const menuItems: { id: UserCenterTab; label: string; subtitle: string; icon: React.ElementType }[] = [
  { id: 'profile', label: '用户信息', subtitle: 'Profile', icon: User },
  { id: 'wallet', label: '钱包', subtitle: 'Wallet', icon: Wallet },
  { id: 'orders', label: '订单', subtitle: 'Orders', icon: ReceiptText },
  { id: 'addresses', label: '地址', subtitle: 'Addresses', icon: MapPin },
  { id: 'coupons', label: '优惠券', subtitle: 'Coupons', icon: TicketPercent },
  { id: 'settings', label: '设置', subtitle: 'Settings', icon: Settings },
];

const UserDropdown: React.FC<UserDropdownProps> = ({ isOpen, session, onClose, onSelect }) => {
  if (!isOpen || !session.user) return null;
  const displayName = session.user.name?.trim() || '深夜食汤会员';

  return (
    <div className="fixed inset-0 z-[90] max-w-md mx-auto bg-black/5" onClick={onClose}>
      <div
        className="absolute right-5 top-[4.5rem] w-[18rem] overflow-hidden rounded-[1.9rem] border border-white/60 bg-[#F4EFE6]/90 p-2 shadow-[0_18px_48px_rgba(45,45,45,0.18)] backdrop-blur-sm animate-slide-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#2D2D2D]/95 px-5 py-4 text-white shadow-xl shadow-black/20">
          <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_18%_0%,rgba(200,169,126,0.38),transparent_52%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.16),transparent_44%)]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Personal Center</p>
            <p className="mt-2 truncate text-base font-bold">{displayName}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/55">
              <span className="truncate">{session.user.displayPhone}</span>
              <span className="flex-none rounded-full border border-white/10 bg-white/10 px-2.5 py-1 font-bold text-[#E7C996]">
                RM {(session.wallet?.balance || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-white/0 px-3 py-3 text-left transition hover:border-white/60 hover:bg-white/70 active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/70 bg-white/80 text-[#C8A97E] shadow-sm backdrop-blur-[2px] transition group-hover:bg-[#2D2D2D] group-hover:text-[#E7C996]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#2D2D2D]">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-stone-500">{item.subtitle}</span>
                </span>
                <ChevronRight size={16} className="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-[#C8A97E]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UserDropdown;
