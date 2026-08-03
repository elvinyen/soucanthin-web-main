
import React from 'react';
import { Home, ReceiptText, ShoppingBag, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type BottomTab = 'home' | 'menu' | 'orders' | 'mine';

interface FooterProps {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
}

const tabs: { id: BottomTab; labelKey: string; icon: React.ElementType }[] = [
  { id: 'home', labelKey: 'common.home', icon: Home },
  { id: 'menu', labelKey: 'common.menu', icon: ShoppingBag },
  { id: 'orders', labelKey: 'common.orders', icon: ReceiptText },
  { id: 'mine', labelKey: 'common.mine', icon: User },
];

const Footer: React.FC<FooterProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();
  return (
    <footer className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 mx-auto max-w-md px-5 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto grid grid-cols-4 gap-1 rounded-[1.75rem] border border-white/75 bg-white/85 px-1.5 py-2 shadow-[0_16px_42px_rgba(45,45,45,0.16)] backdrop-blur-2xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const label = t(tab.labelKey);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-[1.15rem] text-[10px] transition-all duration-300 ${active ? 'text-[#8F6C35]' : 'text-stone-500 active:bg-white/70'}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <span className={`grid h-8 w-10 place-items-center rounded-full transition-all duration-300 ${active ? '-translate-y-0.5 bg-[#B58B4B] text-white shadow-[0_7px_18px_rgba(181,139,75,0.3)]' : 'text-stone-500'}`}>
                <Icon size={18} strokeWidth={active ? 2.25 : 1.8} />
              </span>
              <span className={`leading-none transition-all duration-300 ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
};

export default Footer;
