
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import Banner from './components/Banner';
import LuckyDraw from './components/LuckyDraw';
import OrderSection from './components/OrderSection';
import CharitySection from './components/CharitySection';
import Footer from './components/Footer';
import SiteFooter from './components/SiteFooter';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import LanguageSelector from './components/LanguageSelector';
import Menu from './components/Menu';
import Cart from './components/Cart';
import AuthModal from './components/AuthModal';
import UserCenter, { type UserCenterTab } from './components/UserCenter';
import UserDropdown from './components/UserDropdown';
import OrdersPage from './components/OrdersPage';
import AdminDashboard from './components/AdminDashboard';
import type { AuthMeResponse } from './types/auth';
import type { CartLine } from './data/menu';
import type { BottomTab } from './components/Footer';

type MainView = 'home' | 'menu' | 'orders' | 'mine';

const App: React.FC = () => {
  const { t } = useTranslation();
  const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';
  const [scrolled, setScrolled] = useState(false);
  const [view, setView] = useState<MainView>('home');
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
      setView('mine');
      setUserCenterTab('wallet');
      setUserCenterNotice(t('user.notice.walletStripeSuccess'));
      [0, 1500, 4000, 8000].forEach(delay => {
        window.setTimeout(refreshSession, delay);
      });
    }
    if (walletStatus === 'stripe-cancel') {
      setView('mine');
      setUserCenterTab('wallet');
      setUserCenterNotice('');
      if (walletTransactionId) {
        fetch('/api/wallet/recharge/stripe-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: walletTransactionId }),
        }).finally(refreshSession);
      }
    }
    if (paymentStatus === 'stripe-success') {
      setView('orders');
      setUserCenterTab('orders');
      setUserCenterNotice(t('user.notice.paymentStripeSuccess'));
      [0, 1500, 4000, 8000].forEach(delay => {
        window.setTimeout(refreshSession, delay);
      });
    }
    if (paymentStatus === 'stripe-cancel') {
      setView('menu');
      setAppNotice(t('user.notice.paymentStripeCancel'));
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
    setView('mine');
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

  const handleTabChange = (tab: BottomTab) => {
    setIsUserMenuOpen(false);
    setView(tab);
    if (tab === 'mine') setUserCenterTab('profile');
    if (tab === 'orders' || tab === 'mine') refreshSession();
  };

  if (isAdminRoute) {
    return <AdminDashboard />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-white shadow-xl relative overflow-x-hidden">
      {view === 'home' && (
        <Header
          scrolled={scrolled}
          onLogoClick={() => setView('home')}
          showHomeButton={false}
          onHomeClick={() => setView('home')}
          onUserClick={handleUserClick}
          isLoggedIn={session.authenticated}
        />
      )}
      
      <main className={`flex-grow ${view === 'home' ? 'pt-16' : ''}`}>
        {view === 'home' && (
          <>
            <Banner />
            <div className="px-8 py-10 space-y-16 bg-stone-50/50">
              <LuckyDraw />
              
              <section className="flex flex-col items-center">
                 <h2 className="text-xl font-bold mb-5 serif text-[#2D2D2D] tracking-widest text-center relative pb-3">
                    {t('homePage.startOrder')}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#C8A97E]"></span>
                 </h2>
                 <OrderSection onOrderClick={() => setView('menu')} />
              </section>

              <section className="flex flex-col items-center">
                 <h2 className="text-xl font-bold mb-5 serif text-[#2D2D2D] tracking-widest text-center relative pb-3">
                    {t('homePage.charity')}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#C8A97E]"></span>
                 </h2>
                 <CharitySection />
              </section>
            </div>
            <SiteFooter />
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

        {view === 'orders' && (
          <OrdersPage
            session={session}
            onLogin={() => setIsAuthOpen(true)}
            onOpenHistory={() => {
              setUserCenterTab('orders');
              setView('mine');
            }}
          />
        )}

        {view === 'mine' && (
          session.authenticated ? (
            <UserCenter
              mode="page"
              isOpen
              session={session}
              initialTab={userCenterTab}
              onClose={() => setView('home')}
              onLogout={handleLogout}
              onRefresh={refreshSession}
              externalNotice={userCenterNotice}
            />
          ) : (
            <div className="min-h-screen bg-[#F4EFE6]/80 px-7 pb-32 pt-8">
              <p className="text-[10px] uppercase tracking-[0.24em] text-stone-400">{t('user.account')}</p>
              <h1 className="serif mt-1 text-2xl font-bold text-[#2D2D2D]">{t('user.mine')}</h1>
              <div className="mt-10 rounded-[2rem] border border-white/60 bg-white/65 p-6 text-center shadow-[0_14px_40px_rgba(45,45,45,0.08)] backdrop-blur-xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D2D2D] text-[#C8A97E]">
                  <img src="/logo/sct_logo.png" alt={`${t('common.brandZh')} Logo`} className="h-8 w-8 object-contain" />
                </div>
                <h2 className="serif mt-5 text-lg font-bold text-[#2D2D2D]">{t('user.loginRequiredTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">{t('user.loginRequiredDescription')}</p>
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="mt-6 w-full rounded-full bg-[#2D2D2D] py-4 text-sm font-bold text-white"
                >
                  {t('common.login')}
                </button>
              </div>
            </div>
          )
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
          setView('orders');
          setUserCenterTab('orders');
          refreshSession();
        }}
        onWalletRecharge={() => {
          setIsCartOpen(false);
          setView('mine');
          setUserCenterTab('wallet');
        }}
      />

      <Footer activeTab={view} onTabChange={handleTabChange} />
      {view !== 'home' && view !== 'menu' && (
        <div className="fixed right-5 top-5 z-[60] mx-auto max-w-md">
          <LanguageSelector />
        </div>
      )}
      <FloatingWhatsApp />

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
          showAppNotice(t('user.loginSuccess'));
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
