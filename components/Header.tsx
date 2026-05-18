
import React from 'react';
import { User, Home } from 'lucide-react';

interface HeaderProps {
  scrolled?: boolean;
  onLogoClick?: () => void;
  showHomeButton?: boolean;
  onHomeClick?: () => void;
  onUserClick?: () => void;
  isLoggedIn?: boolean;
}

const Header: React.FC<HeaderProps> = ({ scrolled, onLogoClick, showHomeButton, onHomeClick, onUserClick, isLoggedIn }) => {
  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-5 max-w-md mx-auto border-b border-stone-100/50 transition-all ${
        scrolled ? 'bg-white/95 shadow-sm backdrop-blur-md' : 'bg-white/90'
      }`}
    >
      <div className="flex-1">
        {showHomeButton && (
          <button 
            onClick={onHomeClick}
            className="p-2 bg-stone-50 rounded-full text-stone-600 hover:bg-stone-100 transition-colors animate-fade-in"
          >
            <Home size={20} />
          </button>
        )}
      </div>
      
      <button 
        onClick={onLogoClick}
        className="flex items-center gap-3 active:scale-95 transition-transform"
      >
        <img 
          src="/logo/logo.png" 
          alt="深夜食汤 Logo"
          className="w-full h-10 object-contain"
        />
      </button>

      <div className="flex-1 flex justify-end">
        <button
          onClick={onUserClick}
          className={`relative p-2 rounded-full transition-colors ${
            isLoggedIn ? 'bg-[#2D2D2D] text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
          }`}
          aria-label={isLoggedIn ? '打开个人中心' : '登录'}
        >
          <User size={22} />
          {isLoggedIn && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#C8A97E] ring-2 ring-white" />}
        </button>
      </div>
    </header>
  );
};

export default Header;
