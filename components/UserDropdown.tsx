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

  return (
    <div className="fixed inset-0 z-[90] max-w-md mx-auto" onClick={onClose}>
      <div
        className="absolute right-5 top-[4.5rem] w-[18rem] overflow-hidden rounded-[1.75rem] border border-stone-100 bg-white shadow-2xl shadow-black/15 animate-slide-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[#2D2D2D] px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Personal Center</p>
          <p className="mt-2 truncate text-sm font-bold">{session.user.displayPhone}</p>
          <p className="mt-1 text-[11px] text-white/45">余额 RM {(session.wallet?.balance || 0).toFixed(2)}</p>
        </div>

        <div className="p-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-stone-50 active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FBF7EF] text-[#C8A97E]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#2D2D2D]">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-stone-400">{item.subtitle}</span>
                </span>
                <ChevronRight size={16} className="text-stone-300" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UserDropdown;
