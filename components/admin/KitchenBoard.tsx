import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCircle2, ClipboardList, Clock3, CookingPot, KeyRound, LogOut, MoreHorizontal, PackageCheck, PauseCircle, RefreshCw, Search, Settings, Utensils, WifiOff, X } from 'lucide-react';

type OrderStatus =
  | 'pending_confirm'
  | 'waiting_kitchen'
  | 'cooking'
  | 'kitchen_done'
  | 'stock_issue'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'cancelled';

type KitchenTab = 'waiting' | 'cooking' | 'completed';
type KitchenView = 'orders' | 'menu';
type MenuFilter = 'all' | 'available' | 'sold_out';
type KitchenTone = 'orange' | 'blue' | 'green' | 'red' | 'muted';
type KitchenIcon = React.ComponentType<{ size?: number; className?: string }>;

type KitchenOrderRow = {
  id: string;
  orderNo: string;
  orderType: 'dinein' | 'takeaway';
  tableNo?: string | null;
  createdAt: string;
  status: OrderStatus;
  note?: string | null;
  kitchenStartedAt?: string | null;
  kitchenCompletedAt?: string | null;
  items: {
    id?: string;
    itemCode?: string | null;
    name: string;
    quantity: number;
    note?: string | null;
  }[];
};

type KitchenMenuItem = {
  id: number;
  code?: string | null;
  name: string;
  image?: string | null;
  soldOut: boolean;
  globallySoldOut?: boolean;
};

type KitchenStoreStatus = {
  branchId: string;
  branchName: string;
  configured: boolean;
  scheduledOpen: boolean;
  acceptingOrders: boolean;
  open: boolean;
  pauseReason?: string | null;
};

type KitchenBoardProps = {
  api: <T,>(path: string, init?: RequestInit) => Promise<T>;
  onLogout: () => void;
  onChangePassword?: () => void;
  userName: string;
  standalone?: boolean;
};

export default function KitchenBoard({ api, onLogout, onChangePassword, userName, standalone = false }: KitchenBoardProps) {
  const [orders, setOrders] = useState<KitchenOrderRow[]>([]);
  const [view, setView] = useState<KitchenView>('orders');
  const [activeTab, setActiveTab] = useState<KitchenTab>('waiting');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [menuItems, setMenuItems] = useState<KitchenMenuItem[]>([]);
  const [store, setStore] = useState<KitchenStoreStatus | null>(null);
  const [menuFilter, setMenuFilter] = useState<MenuFilter>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [storeUpdating, setStoreUpdating] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const knownWaitingIdsRef = useRef<Set<string> | null>(null);
  const lastSuccessRef = useRef(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  const waitingOrders = sortKitchenOrders(orders.filter(order => order.status === 'waiting_kitchen'), 'waiting');
  const cookingOrders = sortKitchenOrders(orders.filter(order => order.status === 'cooking'), 'cooking');
  const completedOrders = [...orders]
    .filter(order => order.status === 'kitchen_done')
    .sort((a, b) => new Date(b.kitchenCompletedAt || b.createdAt).getTime() - new Date(a.kitchenCompletedAt || a.createdAt).getTime())
    .slice(0, 10);
  const timeoutCount = waitingOrders.filter(isKitchenOrderTimeout).length + cookingOrders.filter(isKitchenOrderTimeout).length;
  const filteredMenuItems = menuItems.filter(item => {
    const statusMatches = menuFilter === 'all'
      || (menuFilter === 'sold_out' ? item.soldOut : !item.soldOut);
    const query = menuSearch.trim().toLowerCase();
    return statusMatches && (!query || `${item.code || ''} ${item.name}`.toLowerCase().includes(query));
  });

  const loadKitchenOrders = async () => {
    try {
      const payload = await api<{ success: true; orders: KitchenOrderRow[]; syncedAt?: string }>('/api/kitchen/orders');
      const nextOrders = payload.orders || [];
      const nextWaitingIds = new Set(nextOrders.filter(order => order.status === 'waiting_kitchen').map(order => order.id));
      const knownWaitingIds = knownWaitingIdsRef.current;
      const newIds = knownWaitingIds ? [...nextWaitingIds].filter(id => !knownWaitingIds.has(id)) : [];

      if (newIds.length) {
        setHighlightedIds(prev => new Set([...prev, ...newIds]));
        newIds.forEach(id => {
          window.setTimeout(() => {
            setHighlightedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, 5000);
        });
        void playKitchenBeep();
      }

      knownWaitingIdsRef.current = nextWaitingIds;
      setOrders(nextOrders);
      setLastSyncAt(payload.syncedAt ? new Date(payload.syncedAt) : new Date());
      setNetworkError(false);
      setError('');
      lastSuccessRef.current = Date.now();
    } catch {
      if (Date.now() - lastSuccessRef.current > 10000) setNetworkError(true);
      setError('Sync failed');
    }
  };

  useEffect(() => {
    void loadKitchenOrders();
    const interval = window.setInterval(() => {
      void loadKitchenOrders();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [soundEnabled]);

  const loadKitchenMenu = async (quiet = false) => {
    if (!quiet) setMenuLoading(true);
    try {
      const payload = await api<{ success: true; items: KitchenMenuItem[]; store: KitchenStoreStatus }>('/api/kitchen/menu');
      setMenuItems(payload.items || []);
      setStore(payload.store || null);
      setMenuError('');
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : 'Menu sync failed');
    } finally {
      if (!quiet) setMenuLoading(false);
    }
  };

  useEffect(() => {
    if (view !== 'menu') return;
    void loadKitchenMenu();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadKitchenMenu(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (!settingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (settingsRef.current?.contains(event.target as Node)) return;
      setSettingsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  const ensureAudioContext = async () => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    const context = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    return context;
  };

  const enableSound = async () => {
    setSoundEnabled(true);
    await ensureAudioContext();
    void playKitchenBeep();
  };

  const toggleSound = async () => {
    if (soundEnabled) {
      setSoundEnabled(false);
      return;
    }
    await enableSound();
  };

  const playKitchenBeep = async () => {
    if (!soundEnabled) return;
    const context = await ensureAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  };

  const runKitchenAction = async (order: KitchenOrderRow, action: 'start' | 'complete' | 'stock-issue') => {
    setError('');
    setActionOrderId(order.id);
    const path = {
      start: '/api/kitchen/orders/start',
      complete: '/api/kitchen/orders/complete',
      'stock-issue': '/api/kitchen/orders/stock-issue',
    }[action];
    try {
      await api(path, {
        method: 'POST',
        body: JSON.stringify({ id: order.id }),
      });
      await loadKitchenOrders();
    } catch {
      setError('Action failed');
    } finally {
      setActionOrderId(current => current === order.id ? null : current);
    }
  };

  const setItemSoldOut = async (item: KitchenMenuItem, soldOut: boolean) => {
    setMenuError('');
    setUpdatingItemId(item.id);
    try {
      await api('/api/kitchen/menu', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'set-item-availability', itemId: item.id, soldOut }),
      });
      setMenuItems(current => current.map(row => row.id === item.id ? { ...row, soldOut } : row));
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingItemId(current => current === item.id ? null : current);
    }
  };

  const setStoreAccepting = async (acceptingOrders: boolean, reason?: string) => {
    setMenuError('');
    setStoreUpdating(true);
    try {
      const payload = await api<{ success: true; store: KitchenStoreStatus }>('/api/kitchen/menu', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'set-store-accepting', acceptingOrders, reason }),
      });
      setStore(payload.store);
      setPauseDialogOpen(false);
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : 'Store update failed');
    } finally {
      setStoreUpdating(false);
    }
  };

  const mobileTabs = [
    { id: 'waiting' as const, title: 'Wait', count: waitingOrders.length, orders: waitingOrders, tone: 'orange' as const, icon: Clock3 },
    { id: 'cooking' as const, title: 'Cook', count: cookingOrders.length, orders: cookingOrders, tone: 'blue' as const, icon: CookingPot },
    { id: 'completed' as const, title: 'Done', count: completedOrders.length, orders: completedOrders, tone: 'green' as const, icon: CheckCircle2 },
  ];
  const columns = [
    { id: 'waiting' as const, title: 'Waiting', count: waitingOrders.length, orders: waitingOrders, icon: Clock3 },
    { id: 'cooking' as const, title: 'Cooking', count: cookingOrders.length, orders: cookingOrders, icon: CookingPot },
    { id: 'completed' as const, title: 'Done', count: completedOrders.length, orders: completedOrders, icon: PackageCheck },
  ];
  const activeMobileTab = mobileTabs.find(tab => tab.id === activeTab) || mobileTabs[0];

  return (
    <div className={`${standalone ? 'min-h-dvh' : 'min-h-0'} bg-[#F7F8FA] text-slate-950`}>
      <header data-admin-page-header className={`sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur-xl sm:px-5 ${standalone ? '' : 'rounded-t-[20px] border'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img src="/logo/sct_logo.png" alt="Soup Can Thin" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-6 tracking-normal text-slate-950 sm:text-2xl">Kitchen Board</h1>
            </div>
          </div>
          <div ref={settingsRef} className="relative flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(open => !open)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              aria-label="Kitchen settings"
            >
              <Settings size={20} />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-14 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
                <div className="mb-2 px-1">
                  <p className="text-xs font-black uppercase text-slate-400">Settings</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-800">{userName}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">Updated {lastSyncAt ? lastSyncAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex h-14 w-full items-center justify-between rounded-2xl px-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                    <Bell size={18} className="text-slate-400" />
                    <span>Sound alerts</span>
                  </span>
                  <span className={`relative h-7 w-12 rounded-full p-0.5 transition ${soundEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true">
                    <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>
                {onChangePassword && <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    onChangePassword();
                  }}
                  className="flex h-14 w-full items-center justify-between rounded-2xl px-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                    <KeyRound size={18} className="text-slate-400" />
                    <span>Change password</span>
                  </span>
                </button>}
                <button
                  type="button"
                  onClick={() => view === 'menu' ? void loadKitchenMenu() : void loadKitchenOrders()}
                  className="flex h-14 w-full items-center justify-between rounded-2xl px-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                    <RefreshCw size={18} className="text-slate-400" />
                    <span>Refresh now</span>
                  </span>
                  <span className="text-slate-400">3s</span>
                </button>
                {store && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Store orders</p>
                        <p className="mt-1 truncate text-sm font-black text-slate-700">{store.branchName}</p>
                      </div>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${store.acceptingOrders ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                    {store.acceptingOrders ? (
                      <button
                        type="button"
                        disabled={storeUpdating}
                        onClick={() => {
                          setSettingsOpen(false);
                          setPauseDialogOpen(true);
                        }}
                        className="flex h-12 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-black text-slate-500 transition hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                      >
                        <PauseCircle size={18} /> Pause new orders
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={storeUpdating}
                        onClick={() => {
                          setSettingsOpen(false);
                          void setStoreAccepting(true);
                        }}
                        className="flex h-12 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        <CheckCircle2 size={18} /> Resume new orders
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-1 flex h-14 w-full items-center justify-between rounded-2xl px-3 text-left transition hover:bg-red-50"
                >
                  <span className="flex items-center gap-2 text-sm font-black text-red-600">
                    <LogOut size={18} />
                    <span>Logout</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setView('orders')}
            aria-pressed={view === 'orders'}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${view === 'orders' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            <ClipboardList size={20} /> Orders
          </button>
          <button
            type="button"
            onClick={() => setView('menu')}
            aria-pressed={view === 'menu'}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${view === 'menu' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            <Utensils size={20} /> Menu
          </button>
        </div>

        {view === 'orders' && <>
        <div className="mt-4 hidden grid-cols-4 gap-2 md:grid">
          <KitchenStat label="Waiting" value={waitingOrders.length} tone="orange" icon={Clock3} />
          <KitchenStat label="Cooking" value={cookingOrders.length} tone="blue" icon={CookingPot} />
          <KitchenStat label="Done" value={completedOrders.length} tone="green" icon={CheckCircle2} />
          <KitchenStat label="Late" value={timeoutCount} tone="red" icon={AlertTriangle} />
        </div>

        {(timeoutCount > 0 || networkError || error) && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm font-black">
          {timeoutCount > 0 && <span className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-red-100 px-4 py-2 text-red-700"><AlertTriangle size={17} />Late {timeoutCount}</span>}
          {networkError && <span className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-red-100 px-4 py-2 text-red-700"><WifiOff size={17} />Sync may be delayed</span>}
          {error && <span className="inline-flex min-h-10 items-center rounded-2xl bg-red-100 px-4 py-2 text-red-700">{error}</span>}
        </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
          {mobileTabs.map(tab => (
            <React.Fragment key={tab.id}>
              <KitchenTabButton
                active={activeTab === tab.id}
                title={tab.title}
                count={tab.count}
                tone={tab.tone}
                icon={tab.icon}
                onClick={() => setActiveTab(tab.id)}
              />
            </React.Fragment>
          ))}
        </div>
        </>}

        {view === 'menu' && (
          <div className="mt-3 grid gap-3">
            <div className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-3.5 ${store?.acceptingOrders === false ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${store?.open ? 'bg-emerald-500' : store?.acceptingOrders === false ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <p className="truncate text-sm font-black text-slate-700">{store?.branchName || 'Store'}</p>
                <span className={`shrink-0 text-xs font-black uppercase ${store?.open ? 'text-emerald-700' : store?.acceptingOrders === false ? 'text-amber-800' : 'text-slate-500'}`}>
                  {store?.open ? 'Taking orders' : store?.acceptingOrders === false ? 'Orders paused' : 'Outside hours'}
                </span>
              </div>
              {store?.acceptingOrders === false && (
                  <button
                    type="button"
                    disabled={storeUpdating}
                    onClick={() => void setStoreAccepting(true)}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Resume
                  </button>
              )}
            </div>

            {menuError && <div className="flex min-h-11 items-center rounded-2xl bg-red-100 px-4 text-sm font-black text-red-700">{menuError}</div>}

            <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 shadow-sm">
              <Search size={19} className="shrink-0 text-slate-400" />
              <input
                value={menuSearch}
                onChange={event => setMenuSearch(event.target.value)}
                placeholder="Search food or code"
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
              {([
                ['all', 'All', menuItems.length],
                ['available', 'Available', menuItems.filter(item => !item.soldOut).length],
                ['sold_out', 'Sold Out', menuItems.filter(item => item.soldOut).length],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMenuFilter(id)}
                  aria-pressed={menuFilter === id}
                  className={`h-10 rounded-xl px-1.5 text-xs font-black transition ${menuFilter === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                >
                  {label} {count}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="p-4 sm:p-5">
        {view === 'orders' && <>
        <div className="md:hidden">
          <KitchenColumn
            title={activeMobileTab.title}
            showHeader={false}
            orders={activeMobileTab.orders}
            emptyText={emptyKitchenText(activeMobileTab.id)}
            highlightedIds={highlightedIds}
            actionOrderId={actionOrderId}
            onStart={order => runKitchenAction(order, 'start')}
            onComplete={order => runKitchenAction(order, 'complete')}
            onStockIssue={order => runKitchenAction(order, 'stock-issue')}
          />
        </div>

        <div className="hidden gap-3 md:grid md:grid-cols-3">
          {columns.map(column => (
            <React.Fragment key={column.id}>
              <KitchenColumn
                title={`${column.title} ${column.count}`}
                icon={column.icon}
                orders={column.orders}
                emptyText={emptyKitchenText(column.id)}
                highlightedIds={highlightedIds}
                actionOrderId={actionOrderId}
                onStart={order => runKitchenAction(order, 'start')}
                onComplete={order => runKitchenAction(order, 'complete')}
                onStockIssue={order => runKitchenAction(order, 'stock-issue')}
              />
            </React.Fragment>
          ))}
        </div>
        </>}

        {view === 'menu' && (
          <KitchenMenuGrid
            items={filteredMenuItems}
            loading={menuLoading}
            updatingItemId={updatingItemId}
            onSetSoldOut={setItemSoldOut}
          />
        )}
      </main>

      {pauseDialogOpen && (
        <PauseOrdersDialog
          busy={storeUpdating}
          onCancel={() => setPauseDialogOpen(false)}
          onConfirm={reason => void setStoreAccepting(false, reason)}
        />
      )}
    </div>
  );
}

function KitchenMenuGrid({ items, loading, updatingItemId, onSetSoldOut }: {
  items: KitchenMenuItem[];
  loading: boolean;
  updatingItemId: number | null;
  onSetSoldOut: (item: KitchenMenuItem, soldOut: boolean) => void;
}) {
  if (loading && items.length === 0) {
    return <div className="grid min-h-72 place-items-center"><RefreshCw className="animate-spin text-slate-400" size={28} /></div>;
  }
  if (items.length === 0) {
    return <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-base font-black text-slate-400">No matching food</div>;
  }
  return (
    <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(item => {
        const busy = updatingItemId === item.id;
        return (
          <article key={item.id} className={`flex min-h-[88px] items-center gap-3 rounded-[18px] border bg-white p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ${item.soldOut ? 'border-red-100' : 'border-slate-200'}`}>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-slate-100">
              {item.image
                ? <img src={item.image} alt="" className="h-full w-full object-cover" />
                : <div className="grid h-full w-full place-items-center text-slate-300"><Utensils size={24} /></div>}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="min-w-0 flex-1">
                {item.code && <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{item.code}</span>}
                <h2 className="mt-1 line-clamp-2 text-sm font-black leading-[18px] text-slate-950">{item.name}</h2>
              </div>
              <button
                type="button"
                disabled={busy || Boolean(item.globallySoldOut)}
                onClick={() => onSetSoldOut(item, !item.soldOut)}
                aria-label={`${item.name}: ${item.soldOut ? 'Sold out' : 'Available'}`}
                className={`flex h-11 w-[106px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-black transition disabled:opacity-60 ${item.soldOut ? 'bg-red-600 text-white shadow-sm' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}
              >
                {busy ? <RefreshCw size={15} className="animate-spin" /> : item.soldOut ? <X size={16} /> : <Check size={16} />}
                {busy ? 'Updating' : item.globallySoldOut ? 'Disabled' : item.soldOut ? 'Sold out' : 'Available'}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function PauseOrdersDialog({ busy, onCancel, onConfirm }: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('Kitchen busy');
  const reasons = [
    ['Kitchen busy', 'Kitchen busy'],
    ['Food finished', 'Food finished'],
    ['Closing early', 'Closing early'],
    ['Emergency', 'Emergency'],
  ];
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="pause-orders-title" className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><PauseCircle size={25} /></div>
          <div>
            <h2 id="pause-orders-title" className="text-xl font-black text-slate-950">Pause new orders?</h2>
            <p className="mt-1 text-sm font-bold leading-5 text-slate-500">Customers will not be able to place new orders.</p>
          </div>
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-wide text-slate-400">Choose reason</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {reasons.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setReason(value)}
              aria-pressed={reason === value}
              className={`min-h-12 rounded-2xl border px-3 text-sm font-black ${reason === value ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="h-12 rounded-2xl border border-slate-200 text-sm font-black text-slate-600 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(reason)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-black text-white disabled:opacity-50">
            {busy && <RefreshCw size={17} className="animate-spin" />} Pause Orders
          </button>
        </div>
      </section>
    </div>
  );
}

function KitchenTabButton({ active, title, count, tone, icon: Icon, onClick }: {
  active: boolean;
  title: string;
  count: number;
  tone: 'orange' | 'blue' | 'green';
  icon: KitchenIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-[52px] rounded-2xl px-3 text-sm font-black shadow-sm transition ${active ? kitchenTabActiveClass(tone) : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-950'}`}
    >
      <span className="flex items-center justify-center gap-1.5">
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{title}</span>
      </span>
      <span className={`absolute -right-2.5 -top-3 flex min-h-[30px] min-w-[30px] items-center justify-center rounded-full border-[3px] px-2 text-sm font-black leading-none shadow-[0_8px_18px_rgba(15,23,42,0.18)] ${active ? 'border-white bg-slate-950 text-white' : kitchenTabBadgeClass(tone)}`}>
        {count}
      </span>
    </button>
  );
}

function KitchenStat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'orange' | 'blue' | 'green' | 'red'; icon: KitchenIcon }) {
  const className = {
    orange: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }[tone];
  return (
    <div className={`rounded-2xl border px-3 py-2.5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-black uppercase">{label}</p>
        <Icon size={15} className="shrink-0 opacity-75" />
      </div>
      <p className="mt-1.5 text-2xl font-black leading-none">{value}</p>
    </div>
  );
}

function KitchenColumn({ title, icon: Icon = Utensils, showHeader = true, orders, emptyText, highlightedIds, actionOrderId, onStart, onComplete, onStockIssue }: {
  title: string;
  icon?: KitchenIcon;
  showHeader?: boolean;
  orders: KitchenOrderRow[];
  emptyText: string;
  highlightedIds: Set<string>;
  actionOrderId: string | null;
  onStart: (order: KitchenOrderRow) => void;
  onComplete: (order: KitchenOrderRow) => void;
  onStockIssue: (order: KitchenOrderRow) => void;
}) {
  return (
    <section className={`${showHeader ? 'rounded-[22px] border border-slate-200 bg-white/70 p-3 shadow-sm' : ''} min-h-[360px]`}>
      {showHeader && <div className="mb-3 flex items-center gap-2 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
          <Icon size={18} />
        </div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
      </div>}
      <div className="grid gap-3">
        {orders.length === 0 && (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-base font-black text-slate-400">
            {emptyText}
          </div>
        )}
        {orders.map(order => (
          <React.Fragment key={order.id}>
            <KitchenOrderCard
              order={order}
              highlighted={highlightedIds.has(order.id)}
              busy={actionOrderId === order.id}
              onStart={() => onStart(order)}
              onComplete={() => onComplete(order)}
              onStockIssue={() => onStockIssue(order)}
            />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function KitchenOrderCard({ order, highlighted, busy, onStart, onComplete, onStockIssue }: {
  order: KitchenOrderRow;
  highlighted: boolean;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onStockIssue: () => void;
}) {
  const timeout = isKitchenOrderTimeout(order);
  const isDone = order.status === 'kitchen_done';
  const [issueOpen, setIssueOpen] = useState(false);
  const issueMenuRef = useRef<HTMLDivElement | null>(null);
  const sideBarClass = kitchenOrderSideBarClass(order.status);

  useEffect(() => {
    if (!issueOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (issueMenuRef.current?.contains(event.target as Node)) return;
      setIssueOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIssueOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [issueOpen]);

  return (
    <article className={`relative overflow-hidden rounded-[22px] border bg-white p-4 shadow-sm transition ${highlighted ? 'border-amber-400 bg-amber-50 shadow-[0_0_0_3px_rgba(245,158,11,0.22)]' : 'border-slate-100'}`}>
      {sideBarClass && <div className={`absolute bottom-0 left-0 top-0 w-1.5 ${sideBarClass}`} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-black tracking-normal text-slate-950">#{order.orderNo}</p>
          <p className="mt-2 text-sm font-bold text-slate-500">{labelKitchenOrderType(order)}</p>
        </div>
        <div ref={issueMenuRef} className="relative shrink-0">
          {isDone && <KitchenBadge tone="green">Done</KitchenBadge>}
          {!isDone && (
            <button
              type="button"
              onClick={() => setIssueOpen(open => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="More order actions"
            >
              <MoreHorizontal size={19} />
            </button>
          )}
          {issueOpen && !isDone && (
            <div className="absolute right-0 top-11 z-10 w-40 rounded-2xl border border-red-100 bg-white p-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Report this order as an issue?')) onStockIssue();
                  setIssueOpen(false);
                }}
                className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <AlertTriangle size={17} />
                Report issue
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
          <Clock3 size={18} />
          {labelKitchenTime(order)}
        </div>
        {timeout && !isDone && <KitchenBadge tone="red" size="lg">{labelKitchenTimeout(order)}</KitchenBadge>}
      </div>

      <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
        {order.items.map(item => (
          <div key={item.id || `${item.name}-${item.quantity}`} className="px-3 py-2.5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
              <span className="min-w-11 rounded-xl bg-slate-100 px-2.5 py-1.5 text-center text-sm font-extrabold text-slate-800">{item.itemCode || '--'}</span>
              <p className="text-base font-medium leading-6 text-slate-900">{item.name}</p>
              <p className="shrink-0 text-base font-extrabold text-slate-600">x{item.quantity}</p>
            </div>
            {item.note && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">Note: {item.note}</p>}
          </div>
        ))}
      </div>

      {order.note && <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-base font-bold text-amber-800">Note: {order.note}</p>}

      {!isDone && (
        <div className="mt-4">
          {order.status === 'waiting_kitchen' && (
            <button type="button" disabled={busy} onClick={onStart} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-400 disabled:opacity-50">
              <CookingPot size={22} />
              {busy ? 'Working' : 'Start'}
            </button>
          )}
          {order.status === 'cooking' && (
            <button type="button" disabled={busy} onClick={onComplete} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-lg font-black text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50">
              <CheckCircle2 size={21} />
              {busy ? 'Working' : 'Done'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function KitchenBadge({ tone, size = 'sm', children }: { tone: KitchenTone; size?: 'sm' | 'lg'; children: React.ReactNode }) {
  const className = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-amber-50 text-amber-700 border-amber-200',
    muted: 'bg-slate-100 text-slate-500 border-slate-200',
  }[tone];
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-[11px]';
  return <span className={`inline-flex items-center rounded-full border font-black leading-none ${sizeClass} ${className}`}>{children}</span>;
}

function sortKitchenOrders(orders: KitchenOrderRow[], mode: 'waiting' | 'cooking') {
  return [...orders].sort((a, b) => {
    const timeoutDelta = Number(isKitchenOrderTimeout(b)) - Number(isKitchenOrderTimeout(a));
    if (timeoutDelta) return timeoutDelta;
    const aTime = new Date(mode === 'cooking' ? a.kitchenStartedAt || a.createdAt : a.createdAt).getTime();
    const bTime = new Date(mode === 'cooking' ? b.kitchenStartedAt || b.createdAt : b.createdAt).getTime();
    return aTime - bTime;
  });
}

function isKitchenOrderTimeout(order: KitchenOrderRow) {
  const startedAt = order.kitchenStartedAt || order.createdAt;
  if (order.status === 'waiting_kitchen') return Date.now() - new Date(order.createdAt).getTime() > 5 * 60 * 1000;
  if (order.status === 'cooking') return Date.now() - new Date(startedAt).getTime() > 20 * 60 * 1000;
  return false;
}

function labelKitchenTimeout(order: KitchenOrderRow) {
  return order.status === 'cooking' ? 'Late cooking' : 'Late start';
}

function labelKitchenTime(order: KitchenOrderRow) {
  if (order.status === 'kitchen_done') {
    return order.kitchenCompletedAt ? `Completed ${formatKitchenClock(order.kitchenCompletedAt)}` : 'Completed';
  }
  if (order.status === 'cooking') {
    return `Cooking ${formatKitchenDuration(order.kitchenStartedAt || order.createdAt)}`;
  }
  return `Waiting ${formatKitchenDuration(order.createdAt)}`;
}

function formatKitchenClock(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatKitchenDuration(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
  if (minutes >= 120) return `${Math.floor(minutes / 60)}h`;
  return `${minutes} min`;
}

function labelKitchenOrderType(order: KitchenOrderRow) {
  if (order.orderType === 'dinein') return `Dine-in · Table ${order.tableNo || '-'}`;
  return 'Takeaway';
}

function kitchenOrderSideBarClass(status: OrderStatus) {
  if (status === 'waiting_kitchen') return 'bg-amber-200';
  if (status === 'cooking') return 'bg-blue-200';
  if (status === 'kitchen_done') return 'bg-emerald-200';
  return '';
}

function emptyKitchenText(tab: KitchenTab) {
  if (tab === 'waiting') return 'No waiting orders';
  if (tab === 'cooking') return 'No orders cooking';
  return 'No completed orders';
}

function kitchenTabActiveClass(tone: 'orange' | 'blue' | 'green') {
  return {
    orange: 'bg-amber-500 text-white',
    blue: 'bg-blue-600 text-white',
    green: 'bg-emerald-600 text-white',
  }[tone];
}

function kitchenTabBadgeClass(tone: 'orange' | 'blue' | 'green') {
  return {
    orange: 'border-white bg-amber-500 text-white',
    blue: 'border-white bg-blue-600 text-white',
    green: 'border-white bg-emerald-600 text-white',
  }[tone];
}
