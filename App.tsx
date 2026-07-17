
import React, { useCallback, useState, useEffect } from 'react';
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
import type { OrderType } from './types/order';
import { BusinessHoursModal } from './components/BusinessHoursModal';
import { isStoreOpen } from './businessHours';

type MainView = 'home' | 'menu' | 'orders' | 'mine';

const App: React.FC = () => {
  const { t } = useTranslation();
  const normalizedPathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const isAdminRoute = normalizedPathname === '/admin' || normalizedPathname.startsWith('/admin/');
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
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [tableNo, setTableNo] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryAddressLabel, setDeliveryAddressLabel] = useState('');
  const [deliveryAddressId, setDeliveryAddressId] = useState('');
  const [userCenterNotice, setUserCenterNotice] = useState('');
  const [appNotice, setAppNotice] = useState('');
  const [storeOpen, setStoreOpen] = useState(() => isStoreOpen());
  const [isBusinessHoursModalOpen, setIsBusinessHoursModalOpen] = useState(() => !isStoreOpen());
  const closeBusinessHoursModal = useCallback(() => setIsBusinessHoursModalOpen(false), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = (params.get('table') || params.get('t') || '').trim();
    const walletStatus = params.get('wallet');
    const paymentStatus = params.get('payment');
    const paymentOrderNo = params.get('order');
    const walletTransactionId = params.get('tx');
    const referralCode = (params.get('ref') || '').trim().toUpperCase();
    if (referralCode) window.localStorage.setItem('sct_referral_code', referralCode);
    if (table) {
      setTableNumber(table);
      setTableNo(table);
      setOrderType('dinein');
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
      setUserCenterNotice(t('user.notice.paymentStripeSuccess'));
      [0, 1500, 4000, 8000].forEach(delay => {
        window.setTimeout(refreshSession, delay);
      });
    }
    if (paymentStatus === 'stripe-cancel') {
      setView('menu');
      setAppNotice(t('user.notice.paymentStripeCancel'));
      if (paymentOrderNo) {
        fetch('/api/stripe-order-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNo: paymentOrderNo }),
        }).finally(refreshSession);
      }
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
    const updateStoreStatus = () => {
      const nextStoreOpen = isStoreOpen();
      setStoreOpen(currentStoreOpen => {
        if (currentStoreOpen && !nextStoreOpen) setIsBusinessHoursModalOpen(true);
        return nextStoreOpen;
      });
      if (!nextStoreOpen) {
        setIsCartOpen(false);
      }
    };

    const timer = window.setInterval(updateStoreStatus, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session.authenticated || !session.user?.id) return;
    const referralCode = window.localStorage.getItem('sct_referral_code');
    if (!referralCode) return;
    fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bind_referral', referralCode }),
    }).then(async response => {
      const payload = await response.json();
      if (response.ok && payload.success && (payload.bound || payload.reason === 'already_bound' || payload.reason === 'self_referral')) {
        window.localStorage.removeItem('sct_referral_code');
      }
    }).catch(() => undefined);
  }, [session.authenticated, session.user?.id]);

  useEffect(() => {
    const savedAddresses = session.addresses || [];
    if (deliveryAddressId) {
      const savedAddress = savedAddresses.find(item => item.id === deliveryAddressId);
      if (!savedAddress) {
        setDeliveryAddress('');
        setDeliveryAddressLabel('');
        setDeliveryAddressId('');
        return;
      }
      if (deliveryAddress.trim() !== savedAddress.address.trim()) {
        setDeliveryAddress(savedAddress.address);
      }
      if (deliveryAddressLabel !== (savedAddress.label || '')) {
        setDeliveryAddressLabel(savedAddress.label || '');
      }
      return;
    }

    if (deliveryAddress.trim()) return;
    const defaultAddress = savedAddresses.find(item => item.isDefault);
    if (defaultAddress?.address) {
      setDeliveryAddress(defaultAddress.address);
      setDeliveryAddressLabel(defaultAddress.label || '');
      setDeliveryAddressId(defaultAddress.id);
    }
  }, [deliveryAddress, deliveryAddressId, deliveryAddressLabel, session.addresses]);

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
    if (isCartOpen || isAuthOpen || isUserCenterOpen || isBusinessHoursModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isCartOpen, isAuthOpen, isUserCenterOpen, isBusinessHoursModalOpen]);

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

  const openOrdersPage = () => {
    setIsUserMenuOpen(false);
    setView('orders');
    refreshSession();
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

  const openMenu = () => {
    setView('menu');
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
                 <OrderSection onOrderClick={openMenu} />
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
            onViewCart={() => {
              if (storeOpen) setIsCartOpen(true);
              else setIsBusinessHoursModalOpen(true);
            }}
            tableNumber={tableNumber}
            orderType={orderType}
            setOrderType={setOrderType}
            tableNo={tableNo}
            setTableNo={setTableNo}
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
            deliveryAddressLabel={deliveryAddressLabel}
            setDeliveryAddressLabel={setDeliveryAddressLabel}
            setDeliveryAddressId={setDeliveryAddressId}
            session={session}
            orderingEnabled={storeOpen}
            onClosedInteraction={() => setIsBusinessHoursModalOpen(true)}
          />
        )}

        {view === 'orders' && (
          <OrdersPage
            session={session}
            onLogin={() => setIsAuthOpen(true)}
            onOpenHistory={() => {
              setView('orders');
              refreshSession();
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
            <div className="min-h-screen bg-stone-50 px-6 pb-32 pt-7 text-[#2D2D2D]">
              <h1 className="serif text-2xl font-bold text-[#2D2D2D]">{t('user.mine')}</h1>
              <div className="mt-10 rounded-[2rem] bg-white p-6 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#C7A46A]/12 text-[#C7A46A]">
                  <img src="/logo/sct_logo.png" alt={`${t('common.brandZh')} Logo`} className="h-8 w-8 object-contain" />
                </div>
                <h2 className="serif mt-5 text-lg font-bold text-[#2D2D2D]">{t('user.loginRequiredTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-[#8A8175]">{t('user.loginRequiredDescription')}</p>
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="mt-6 w-full rounded-full bg-[#C7A46A] py-4 text-sm font-bold text-white shadow-xl shadow-[#C7A46A]/20"
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
        orderType={orderType}
        setOrderType={setOrderType}
        tableNo={tableNo}
        setTableNo={setTableNo}
        address={deliveryAddress}
        setAddress={setDeliveryAddress}
        addressLabel={deliveryAddressLabel}
        setAddressLabel={setDeliveryAddressLabel}
        setAddressId={setDeliveryAddressId}
        session={session}
        onRefreshSession={refreshSession}
        onOrderSuccess={() => {
          setIsCartOpen(false);
          setView('orders');
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
        <div className="pointer-events-none fixed left-1/2 top-7 z-[60] w-full max-w-md -translate-x-1/2 px-5">
          <div className="flex justify-end">
            <LanguageSelector className="pointer-events-auto" />
          </div>
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
        onOrders={openOrdersPage}
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

      <BusinessHoursModal
        isOpen={isBusinessHoursModalOpen}
        onClose={closeBusinessHoursModal}
      />
    </div>
  );
};

export default App;
