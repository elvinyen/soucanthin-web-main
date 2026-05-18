
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Banner from './components/Banner';
import LuckyDraw from './components/LuckyDraw';
import OrderSection from './components/OrderSection';
import CharitySection from './components/CharitySection';
import Footer from './components/Footer';
import Menu from './components/Menu';
import Cart from './components/Cart';
import AuthModal from './components/AuthModal';
import UserCenter, { type UserCenterTab } from './components/UserCenter';
import UserDropdown from './components/UserDropdown';
import type { AuthMeResponse } from './types/auth';
import type { CartLine } from './data/menu';

const App: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [view, setView] = useState<'home' | 'menu'>('home');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUserCenterOpen, setIsUserCenterOpen] = useState(false);
  const [userCenterTab, setUserCenterTab] = useState<UserCenterTab>('profile');
  const [session, setSession] = useState<AuthMeResponse>({ success: true, authenticated: false });
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [userCenterNotice, setUserCenterNotice] = useState('');
  const [appNotice, setAppNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = (params.get('table') || params.get('t') || '').trim();
    const walletStatus = params.get('wallet');
    const paymentStatus = params.get('payment');
    const walletTransactionId = params.get('tx');
    if (table) {
      setTableNumber(table);
      setView('menu');
    }
    if (walletStatus === 'stripe-success') {
      setUserCenterTab('wallet');
      setUserCenterNotice('线上转账已完成，正在更新钱包余额。');
      setIsUserCenterOpen(true);
      [0, 1500, 4000, 8000].forEach(delay => {
        window.setTimeout(refreshSession, delay);
      });
    }
    if (walletStatus === 'stripe-cancel') {
      setUserCenterTab('wallet');
      setUserCenterNotice('');
      setIsUserCenterOpen(true);
      if (walletTransactionId) {
        fetch('/api/wallet/recharge/stripe-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: walletTransactionId }),
        }).finally(refreshSession);
      }
    }
    if (paymentStatus === 'stripe-success') {
      setView('menu');
      setUserCenterNotice('线上付款成功，订单会在员工端同步。');
    }
    if (walletStatus || paymentStatus || walletTransactionId || params.get('order')) {
      ['wallet', 'payment', 'tx', 'order'].forEach(key => params.delete(key));
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const payload = await res.json();
      if (payload.success) setSession(payload);
    } catch {
      setSession({ success: false, authenticated: false });
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top when switching main views
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Prevent body scroll when cart drawer is open
  useEffect(() => {
    if (isCartOpen || isAuthOpen || isUserCenterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isCartOpen, isAuthOpen, isUserCenterOpen]);

  const handleUserClick = () => {
    if (session.authenticated) {
      setIsUserMenuOpen(prev => !prev);
    } else {
      setIsAuthOpen(true);
    }
  };

  const openUserCenter = (tab: UserCenterTab) => {
    setUserCenterTab(tab);
    setIsUserMenuOpen(false);
    setIsUserCenterOpen(true);
  };

  const handleLogout = () => {
    setSession({ success: true, authenticated: false });
    setIsUserMenuOpen(false);
    setIsUserCenterOpen(false);
  };

  const showAppNotice = (message: string) => {
    setAppNotice(message);
    window.setTimeout(() => setAppNotice(''), 2200);
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-white shadow-xl relative overflow-x-hidden">
      <Header 
        scrolled={scrolled} 
        onLogoClick={() => setView('home')} 
        showHomeButton={view === 'menu'}
        onHomeClick={() => setView('home')}
        onUserClick={handleUserClick}
        isLoggedIn={session.authenticated}
      />
      
      <main className="flex-grow pt-16">
        {view === 'home' && (
          <>
            <Banner />
            <div className="px-8 py-10 space-y-16 bg-stone-50/50">
              <LuckyDraw />
              
              <section className="flex flex-col items-center">
                 <h2 className="text-xl font-bold mb-5 serif text-[#2D2D2D] tracking-widest text-center relative pb-3">
                    开始点单
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#C8A97E]"></span>
                 </h2>
                 <OrderSection onOrderClick={() => setView('menu')} />
              </section>

              <section className="flex flex-col items-center">
                 <h2 className="text-xl font-bold mb-5 serif text-[#2D2D2D] tracking-widest text-center relative pb-3">
                    慈善事业
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#C8A97E]"></span>
                 </h2>
                 <CharitySection />
              </section>
            </div>
          </>
        )}

        {view === 'menu' && (
          <Menu 
            cart={cart} 
            setCart={setCart} 
            onViewCart={() => setIsCartOpen(true)} 
            tableNumber={tableNumber}
          />
        )}
      </main>

      {/* Cart Drawer Overlay */}
      <Cart 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart} 
        setCart={setCart} 
        tableNumber={tableNumber}
        session={session}
        onRefreshSession={refreshSession}
        onOrderSuccess={() => {
          setIsCartOpen(false);
          setView('menu');
        }}
      />

      <Footer />

      {appNotice && (
        <div className="fixed left-1/2 top-20 z-[130] w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-[#2D2D2D] px-5 py-3 text-center text-sm font-bold text-white shadow-2xl">
          {appNotice}
        </div>
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthenticated={(nextSession) => {
          setSession(nextSession);
          setIsUserMenuOpen(false);
          showAppNotice('登录成功');
        }}
      />

      <UserDropdown
        isOpen={isUserMenuOpen}
        session={session}
        onClose={() => setIsUserMenuOpen(false)}
        onSelect={openUserCenter}
      />

      <UserCenter
        isOpen={isUserCenterOpen}
        session={session}
        initialTab={userCenterTab}
        onClose={() => setIsUserCenterOpen(false)}
        onLogout={handleLogout}
        onRefresh={refreshSession}
        externalNotice={userCenterNotice}
      />
    </div>
  );
};

export default App;
