
import React from 'react';
import { Home, ReceiptText, ShoppingBag, User } from 'lucide-react';

export type BottomTab = 'home' | 'menu' | 'orders' | 'mine';

interface FooterProps {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
}

const tabs: { id: BottomTab; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'menu', label: '点餐', icon: ShoppingBag },
  { id: 'orders', label: '订单', icon: ReceiptText },
  { id: 'mine', label: '我的', icon: User },
];

const Footer: React.FC<FooterProps> = ({ activeTab, onTabChange }) => {
  return (
    <footer className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 mx-auto max-w-md px-5 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto grid grid-cols-4 gap-1 rounded-full border border-white/65 bg-white/72 p-1.5 shadow-[0_18px_55px_rgba(45,45,45,0.22)] backdrop-blur-2xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold transition-all ${
                active ? 'bg-[#2D2D2D] text-[#C8A97E] shadow-lg shadow-black/15' : 'text-stone-500 active:bg-white/70'
              }`}
              aria-label={tab.label}
            >
              <Icon size={19} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
};

export default Footer;
