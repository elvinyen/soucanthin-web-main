import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Hash, Minus, Plus, Search, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartLine, CartOption, MENU_ITEMS, MenuItem } from '../data/menu';
import { localizeMenuItems } from '../data/menuTranslations';
import type { LanguageCode } from '../types/i18n';
import type { OrderType } from '../types/order';
import type { AuthMeResponse } from '../types/auth';
import LanguageSelector from './LanguageSelector';
import { AddressSelectionDrawer, LocationButton, OrderTypePrompt, OrderTypeSegmentedControl } from './OrderPreferenceControls';

interface MenuProps {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  onViewCart: () => void;
  tableNumber: string | null;
  orderType: OrderType;
  setOrderType: React.Dispatch<React.SetStateAction<OrderType>>;
  tableNo: string;
  setTableNo: React.Dispatch<React.SetStateAction<string>>;
  deliveryAddress: string;
  setDeliveryAddress: React.Dispatch<React.SetStateAction<string>>;
  deliveryAddressLabel: string;
  setDeliveryAddressLabel: React.Dispatch<React.SetStateAction<string>>;
  setDeliveryAddressId: React.Dispatch<React.SetStateAction<string>>;
  session: AuthMeResponse;
  orderingEnabled: boolean;
  onClosedInteraction: () => void;
}

const Menu: React.FC<MenuProps> = ({
  cart,
  setCart,
  onViewCart,
  tableNumber,
  orderType,
  setOrderType,
  tableNo,
  setTableNo,
  deliveryAddress,
  setDeliveryAddress,
  deliveryAddressLabel,
  setDeliveryAddressLabel,
  setDeliveryAddressId,
  session,
  orderingEnabled,
  onClosedInteraction,
}) => {
  const { i18n, t } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] as LanguageCode;
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => localizeMenuItems(MENU_ITEMS, language));
  const [activeCategory, setActiveCategory] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [isTableEditorOpen, setIsTableEditorOpen] = useState(false);
  const [draftTableNo, setDraftTableNo] = useState(tableNo);
  const [isOrderPromptOpen, setIsOrderPromptOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let mounted = true;
    fetch(`/api/menu?lang=${encodeURIComponent(language)}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Menu request failed')))
      .then(payload => {
        if (mounted && payload.success && Array.isArray(payload.items) && payload.items.length > 0) {
          setMenuItems(localizeMenuItems(payload.items, language));
        }
      })
      .catch(() => {
        if (mounted) setMenuItems(localizeMenuItems(MENU_ITEMS, language));
      });
    return () => {
      mounted = false;
    };
  }, [language]);

  useEffect(() => {
    if (tableNumber?.trim()) return;
    const seen = window.sessionStorage.getItem('sct-order-mode-selected');
    if (!seen) setIsOrderPromptOpen(true);
  }, [tableNumber]);

  useEffect(() => {
    setDraftTableNo(tableNo);
  }, [tableNo]);

  const visibleMenuItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return menuItems;
    return menuItems.filter(item => {
      const haystack = [
        item.code,
        item.name,
        item.description,
        item.detail,
        item.category,
        ...item.tags,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [menuItems, searchQuery]);

  const categoryTabs = useMemo(() => {
    return Array.from(new Set(visibleMenuItems.map(item => item.category).filter(Boolean)));
  }, [visibleMenuItems]);

  const categorySections = useMemo(() => {
    return categoryTabs.map(category => ({
      category,
      items: visibleMenuItems.filter(item => item.category === category),
    }));
  }, [categoryTabs, visibleMenuItems]);

  useEffect(() => {
    if (!categoryTabs.length) {
      setActiveCategory('');
      return;
    }
    setActiveCategory(current => categoryTabs.includes(current) ? current : categoryTabs[0]);
  }, [categoryTabs]);

  useEffect(() => {
    if (!selectedItem) return;
    const updatedItem = menuItems.find(item => item.id === selectedItem.id);
    if (updatedItem && updatedItem !== selectedItem) setSelectedItem(updatedItem);
  }, [menuItems, selectedItem]);

  useEffect(() => {
    if (!orderingEnabled) setSelectedItem(null);
  }, [orderingEnabled]);

  useEffect(() => {
    if (!categoryTabs.length) return;

    const updateActiveCategory = () => {
      const headerOffset = 112;
      const currentCategory = categoryTabs.reduce((current, category) => {
        const section = categoryRefs.current[category];
        if (!section) return current;
        return section.getBoundingClientRect().top <= headerOffset ? category : current;
      }, categoryTabs[0]);
      setActiveCategory(current => current === currentCategory ? current : currentCategory);
    };

    updateActiveCategory();
    window.addEventListener('scroll', updateActiveCategory, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveCategory);
  }, [categoryTabs]);

  const scrollToCategory = (category: string) => {
    const section = categoryRefs.current[category];
    if (!section) return;
    setActiveCategory(category);
    setIsCategoryOpen(false);
    const headerOffset = 112;
    const top = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const handleOrderTypeChange = (nextType: OrderType) => {
    setOrderType(nextType);
    window.sessionStorage.setItem('sct-order-mode-selected', nextType);
    if (nextType === 'takeaway' && !deliveryAddress.trim()) setIsAddressDrawerOpen(true);
  };

  const handlePromptSelect = (nextType: OrderType) => {
    handleOrderTypeChange(nextType);
    setIsOrderPromptOpen(false);
  };

  const handleLocationClick = () => {
    if (orderType === 'takeaway') {
      setIsAddressDrawerOpen(true);
      return;
    }
    setDraftTableNo(tableNo);
    setIsTableEditorOpen(true);
  };

  const itemQuantity = (id: number) => cart
    .filter(line => line.itemId === id)
    .reduce((sum, line) => sum + line.quantity, 0);

  const runDishAction = (action: () => void) => {
    if (!orderingEnabled) {
      onClosedInteraction();
      return;
    }
    action();
  };

  const removeLatestItemQuantity = (id: number) => {
    setCart(prev => {
      const index = [...prev].reverse().findIndex(line => line.itemId === id);
      if (index === -1) return prev;
      const targetIndex = prev.length - 1 - index;
      const target = prev[targetIndex];
      if (target.quantity <= 1) return prev.filter((_, lineIndex) => lineIndex !== targetIndex);
      return prev.map((line, lineIndex) => (
        lineIndex === targetIndex ? { ...line, quantity: line.quantity - 1 } : line
      ));
    });
  };

  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);
  const totalPrice = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-40">
      <div className="fixed top-0 left-0 right-0 z-40 max-w-md mx-auto border-b border-stone-200/50 bg-white/95 backdrop-blur-xl">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)_minmax(0,1fr)] items-center gap-2 px-4 pt-2.5 pb-1.5">
          <div className="min-w-0 justify-self-start">
            <OrderTypeSegmentedControl value={orderType} onChange={handleOrderTypeChange} />
          </div>
          <div className="min-w-0 justify-self-center">
            <LocationButton
              orderType={orderType}
              tableNo={tableNo}
              address={deliveryAddress}
              addressLabel={deliveryAddressLabel}
              onClick={handleLocationClick}
            />
          </div>
          <LanguageSelector className="justify-self-end" />
        </div>
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-300" size={15} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('menuPage.searchPlaceholder')}
              className="h-9 w-full rounded-full border border-stone-200/70 bg-white pl-9 pr-3.5 text-xs font-medium text-[#2D2D2D] outline-none transition placeholder:text-stone-400 focus:border-stone-400/70"
            />
          </div>
          <div className="relative flex-none">
            <button
              type="button"
              onClick={() => setIsCategoryOpen(prev => !prev)}
              className="flex h-9 w-28 max-w-full items-center justify-between gap-2 rounded-full border border-stone-200/70 bg-white px-3.5 text-left text-xs font-medium text-[#2D2D2D] transition active:scale-[0.98]"
            >
              <span className="min-w-0 truncate">{activeCategory || categoryTabs[0] || ''}</span>
              <ChevronDown size={15} className={`flex-none transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {isCategoryOpen && (
          <>
            <button
              type="button"
              aria-label="Close category menu"
              className="fixed inset-0 top-[5.9rem] cursor-default bg-transparent"
              onClick={() => setIsCategoryOpen(false)}
            />
            <div className="absolute right-4 top-full z-10 mt-2 w-56 rounded-2xl border border-stone-200/70 bg-white p-2 shadow-xl shadow-black/10">
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto no-scrollbar">
                {categoryTabs.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => scrollToCategory(category)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                      activeCategory === category
                        ? 'bg-[#2D2D2D] text-white'
                        : 'bg-white text-stone-500 active:bg-stone-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{category}</span>
                    {activeCategory === category && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-6 pt-32 pb-8">
        {categorySections.length === 0 && (
          <div className="rounded-3xl bg-white p-8 text-center text-sm text-stone-400 shadow-sm">
            {searchQuery.trim() ? t('menuPage.emptySearch') : t('menuPage.emptyCategory')}
          </div>
        )}
        <div className="space-y-12">
          {categorySections.map(section => (
            <section
              key={section.category}
              ref={(node) => {
                categoryRefs.current[section.category] = node;
              }}
              className="scroll-mt-24"
            >
              <div className="mb-6 flex items-center gap-3">
                <h3 className="text-xl font-bold tracking-widest text-[#2D2D2D] serif">{section.category}</h3>
                <span className="h-px flex-1 bg-[#C8A97E]/35" />
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-10">
                {section.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => runDishAction(() => setSelectedItem(item))}
                    className="flex flex-col animate-fade-in text-left"
                  >
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-md bg-white">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      {(item.displayLabel || item.recommended) && (
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-[#C8A97E] px-2 py-1 text-[10px] font-bold text-white shadow">
                          {item.displayLabel || t('menuPage.recommended')}
                        </span>
                      )}
                      {item.soldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/65 text-sm font-bold text-stone-700 backdrop-blur-[1px]">
                          {t('menuPage.soldOut')}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-1 flex-col items-center text-center">
                      <h4 className="flex items-center justify-center gap-1.5 text-sm font-bold text-[#2D2D2D] serif">
                        {item.code && (
                          <span className="rounded-full bg-[#2D2D2D] px-2 py-0.5 text-[10px] font-bold leading-4 text-white">
                            {item.code}
                          </span>
                        )}
                        <span>{item.name}</span>
                      </h4>
                      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-center gap-1">
                        {item.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-stone-500 shadow-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-bold text-[#C8A97E] serif mt-2 mb-4">RM {item.price.toFixed(2)}</div>

                      <div className="flex items-center space-x-4 bg-white rounded-full p-1 shadow-sm border border-stone-50">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            runDishAction(() => removeLatestItemQuantity(item.id));
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-50 text-stone-400 active:scale-90 transition-all"
                        >
                          <Minus size={14} />
                        </span>
                        <span className="text-sm font-semibold w-4 text-center text-[#2D2D2D]">
                          {itemQuantity(item.id)}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            runDishAction(() => {
                              if (!item.soldOut) setSelectedItem(item);
                            });
                          }}
                          className={`w-7 h-7 flex items-center justify-center rounded-full active:scale-90 transition-all shadow-md ${
                            item.soldOut
                              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                              : 'bg-[#C8A97E] text-white shadow-[#C8A97E]/20'
                          }`}
                        >
                          <Plus size={14} />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {section.items.length === 0 && (
                  <div className="col-span-2 rounded-3xl bg-white p-8 text-center text-sm text-stone-400 shadow-sm">
                    {t('menuPage.emptyCategory')}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedItem && (
        <DishDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAdd={(line) => {
            setCart(prev => {
              const existing = prev.find(current => current.lineId === line.lineId);
              if (existing) {
                return prev.map(current => current.lineId === line.lineId
                  ? { ...current, quantity: current.quantity + line.quantity }
                  : current
                );
              }
              return [...prev, line];
            });
            setSelectedItem(null);
          }}
        />
      )}

      <OrderTypePrompt isOpen={isOrderPromptOpen} onSelect={handlePromptSelect} onClose={() => setIsOrderPromptOpen(false)} />

      <AddressSelectionDrawer
        isOpen={isAddressDrawerOpen}
        address={deliveryAddress}
        savedAddresses={session.addresses || []}
        onClose={() => setIsAddressDrawerOpen(false)}
        onConfirm={(nextAddress, savedAddress, nextAddressLabel) => {
          setDeliveryAddress(nextAddress);
          setDeliveryAddressLabel(nextAddressLabel || '');
          setDeliveryAddressId(savedAddress?.id || '');
          setIsAddressDrawerOpen(false);
        }}
      />

      {isTableEditorOpen && (
        <div className="fixed inset-0 z-[130] mx-auto max-w-md bg-black/35 backdrop-blur-[2px]">
          <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-stone-100 bg-white p-5 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400">{t('menuPage.tableLocation')}</p>
                <h2 className="serif mt-1 text-xl font-bold text-[#2D2D2D]">{t('menuPage.enterTableNo')}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTableEditorOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200/70 bg-white text-stone-500 shadow-sm"
                aria-label={t('common.close')}
              >
                <ArrowLeft size={18} />
              </button>
            </div>
            <div className="relative mt-5">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={17} />
              <input
                value={draftTableNo}
                onChange={(event) => setDraftTableNo(event.target.value)}
                placeholder={t('cart.tableNo')}
                className="h-12 w-full rounded-2xl border border-stone-200/70 bg-white pl-11 pr-4 text-sm text-[#2D2D2D] outline-none transition focus:border-stone-400/70"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setTableNo(draftTableNo.trim());
                setIsTableEditorOpen(false);
              }}
              className="mt-5 min-h-[3.5rem] w-full rounded-full bg-[#2D2D2D] text-sm font-bold tracking-widest text-white shadow-xl transition active:scale-[0.98]"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-24 left-0 right-0 z-50 px-8 max-w-md mx-auto pointer-events-none">
          <button
            onClick={onViewCart}
            className="pointer-events-auto w-full flex items-center justify-between bg-[#2D2D2D] text-white p-4 rounded-full shadow-2xl shadow-black/40 border border-white/5 animate-slide-up active:scale-[0.98] transition-all"
          >
            <div className="flex items-center space-x-4 pl-2">
              <div className="relative p-2 bg-[#C8A97E] rounded-full shadow-lg">
                <ShoppingBag size={20} />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-[#2D2D2D] text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#2D2D2D]">
                  {totalItems}
                </span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-medium text-stone-400 leading-none">{t('menuPage.selected')}</span>
                <span className="text-sm font-bold serif leading-tight">{t('common.pieces', { count: totalItems })} · RM {totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white text-[#2D2D2D] px-6 py-2.5 rounded-full font-bold text-sm">
              <span>{t('menuPage.viewCart')}</span>
              <ChevronRight size={16} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

function DishDetail({ item, onClose, onAdd }: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');

  const selectedOptions = useMemo<CartOption[]>(() => {
    return (item.optionGroups || []).flatMap(group => {
      const selectedIds = selectedByGroup[group.id] || [];
      return group.options
        .filter(option => selectedIds.includes(option.id))
        .map(option => ({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
        }));
    });
  }, [item.optionGroups, selectedByGroup]);

  const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0);
  const unitPrice = item.price + optionsTotal;
  const missingRequired = (item.optionGroups || []).some(group => group.required && !(selectedByGroup[group.id] || []).length);

  const toggleOption = (groupId: string, optionId: string, type: 'single' | 'multiple') => {
    setSelectedByGroup(prev => {
      const current = prev[groupId] || [];
      if (type === 'single') {
        return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      }
      return {
        ...prev,
        [groupId]: current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId],
      };
    });
  };

  const handleAdd = () => {
    const normalizedNote = note.trim();
    const optionKey = selectedOptions
      .map(option => `${option.groupId}:${option.optionId}`)
      .sort()
      .join('|');
    onAdd({
      lineId: `${item.id}__${optionKey || 'plain'}__${encodeURIComponent(normalizedNote)}`,
      itemId: item.id,
      code: item.code,
      name: item.name,
      image: item.image,
      basePrice: item.price,
      optionsTotal,
      unitPrice,
      quantity,
      selectedOptions,
      note: normalizedNote || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[90] max-w-md mx-auto bg-[#FAFAFA] animate-fade-in">
      <button
        onClick={onClose}
        className="absolute left-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#2D2D2D] shadow"
        aria-label={t('menuPage.backToMenu')}
      >
        <ArrowLeft size={19} />
      </button>
      <div className="h-full overflow-y-auto pb-32 no-scrollbar">
        <div className="relative aspect-square bg-white">
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          {item.soldOut && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px]" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/45" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <h2 className="flex flex-wrap items-center gap-2 text-3xl font-bold serif">
              {item.code && (
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold leading-5 backdrop-blur">
                  {item.code}
                </span>
              )}
              <span>{item.name}</span>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map(tag => (
                <span key={tag} className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold backdrop-blur">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{t('menuPage.unitPrice')}</p>
            <p className="mt-2 text-2xl font-bold serif text-[#C8A97E]">RM {unitPrice.toFixed(2)}</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{t('menuPage.dishIntro')}</h3>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm leading-7 text-stone-600">{item.detail || item.description}</p>
            </div>
          </section>

          {(item.optionGroups || []).map(group => (
            <section key={group.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{group.name}</h3>
                <span className="text-[10px] text-stone-400">{group.required ? t('menuPage.required') : group.type === 'single' ? t('menuPage.single') : t('menuPage.multiple')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {group.options.map(option => {
                  const selected = (selectedByGroup[group.id] || []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(group.id, option.id, group.type)}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? 'border-[#C8A97E] bg-[#FBF7EF] text-[#2D2D2D]'
                          : 'border-stone-100 bg-white text-stone-500'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-bold">{option.name}</span>
                        {option.priceDelta > 0 && <span className="mt-1 block text-[11px] text-[#C8A97E]">+ RM {option.priceDelta.toFixed(2)}</span>}
                      </span>
                      {selected && <Check size={16} className="text-[#C8A97E]" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{t('menuPage.merchantNote')}</h3>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={t('menuPage.notePlaceholder')}
              className="w-full resize-none rounded-3xl border border-stone-100 bg-white px-5 py-4 text-sm outline-none shadow-sm focus:border-[#C8A97E]"
            />
          </section>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-stone-100 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-4 rounded-full border border-stone-100 bg-stone-50 p-1">
            <button onClick={() => setQuantity(prev => Math.max(1, prev - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm">
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-sm font-bold text-[#2D2D2D]">{quantity}</span>
            <button onClick={() => setQuantity(prev => prev + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D2D2D] text-white shadow-sm">
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={item.soldOut || missingRequired}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-full py-4 text-sm font-bold tracking-widest shadow-xl ${
              item.soldOut || missingRequired
                ? 'bg-stone-200 text-stone-400'
                : 'bg-[#C8A97E] text-white shadow-[#C8A97E]/30 active:scale-95'
            }`}
          >
            {item.soldOut ? t('menuPage.soldOut') : `${t('menuPage.addToCart')} · RM ${(unitPrice * quantity).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Menu;
