import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bike, Check, ChevronDown, Hash, Loader2, MapPin, Search, Utensils, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UserAddress } from '../types/auth';
import type { OrderType } from '../types/order';

interface OrderTypeSegmentedControlProps {
  value: OrderType;
  onChange: (value: OrderType) => void;
}

interface LocationButtonProps {
  orderType: OrderType;
  tableNo: string;
  address: string;
  addressLabel?: string;
  onClick: () => void;
}

interface AddressSelectionDrawerProps {
  isOpen: boolean;
  address: string;
  savedAddresses?: UserAddress[];
  requireSelection?: boolean;
  onClose: () => void;
  onConfirm: (address: string, savedAddress?: UserAddress, addressLabel?: string) => void;
}

type AddressSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

interface OrderTypePromptProps {
  isOpen: boolean;
  onSelect: (value: OrderType) => void;
  onClose?: () => void;
}

export function OrderTypeSegmentedControl({ value, onChange }: OrderTypeSegmentedControlProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const selectOrderType = (nextValue: OrderType) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-8 items-center gap-1.5 px-1 text-left text-xs font-bold text-[#2D2D2D] transition active:scale-[0.98]"
      >
        {value === 'takeaway' ? <Bike size={14} className="text-stone-500" /> : <Utensils size={14} className="text-stone-500" />}
        <span>{value === 'takeaway' ? t('cart.takeaway') : t('cart.dineIn')}</span>
        <ChevronDown size={13} className="text-stone-400" />
      </button>
      <OrderTypePrompt isOpen={isOpen} onSelect={selectOrderType} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function LocationButton({ orderType, tableNo, address, addressLabel, onClick }: LocationButtonProps) {
  const { t } = useTranslation();
  const icon = orderType === 'takeaway' ? <MapPin size={14} /> : <Hash size={14} />;
  const fallback = orderType === 'takeaway' ? t('menuPage.chooseAddress') : t('menuPage.enterTableNo');
  const value = orderType === 'takeaway' ? getAddressTitle(address, addressLabel) : tableNo.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex min-h-8 w-full min-w-0 max-w-[11rem] items-center justify-center gap-1.5 px-1 text-center text-xs font-semibold text-[#2D2D2D] transition active:scale-[0.99]"
    >
      <span className="flex-none text-stone-400">
        {icon}
      </span>
      <span className={`min-w-0 truncate ${value ? '' : 'text-stone-400'}`}>
        {value || fallback}
      </span>
    </button>
  );
}

export function OrderTypePrompt({ isOpen, onSelect, onClose }: OrderTypePromptProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] mx-auto max-w-md bg-black/35 backdrop-blur-[2px]" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-stone-100 bg-white p-5 shadow-2xl animate-slide-up" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200" />
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400">{t('menuPage.startOrderMode')}</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h2 className="serif text-xl font-bold text-[#2D2D2D]">{t('menuPage.chooseOrderType')}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition active:scale-95"
              aria-label={t('common.close')}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="mt-5 divide-y divide-stone-100">
          <button
            type="button"
            onClick={() => onSelect('takeaway')}
            className="flex w-full items-center gap-3 py-4 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-stone-50 text-[#C8A97E]">
              <Bike size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#2D2D2D]">{t('cart.takeaway')}</span>
              <span className="mt-1 block text-[11px] leading-5 text-stone-500">{t('menuPage.takeawayFirstHint')}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelect('dinein')}
            className="flex w-full items-center gap-3 py-4 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-stone-50 text-[#C8A97E]">
              <Utensils size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#2D2D2D]">{t('cart.dineIn')}</span>
              <span className="mt-1 block text-[11px] leading-5 text-stone-500">{t('menuPage.dineinFirstHint')}</span>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AddressSelectionDrawer({
  isOpen,
  address,
  savedAddresses = [],
  requireSelection = false,
  onClose,
  onConfirm,
}: AddressSelectionDrawerProps) {
  const { i18n, t } = useTranslation();
  const [query, setQuery] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [selectingPlaceId, setSelectingPlaceId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSuggestions([]);
    setSearchStatus('idle');
    setSelectingPlaceId('');
    setErrorMessage('');
    setSessionToken(createSessionToken());
  }, [isOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAddresses = useMemo(() => {
    if (!normalizedQuery) return savedAddresses;
    return savedAddresses.filter(item => (
      item.address.toLowerCase().includes(normalizedQuery)
      || item.label.toLowerCase().includes(normalizedQuery)
      || item.recipientName.toLowerCase().includes(normalizedQuery)
    ));
  }, [normalizedQuery, savedAddresses]);

  useEffect(() => {
    if (!isOpen) return;

    const input = query.trim();
    if (input.length < 2) {
      setSuggestions([]);
      setSearchStatus('idle');
      setErrorMessage('');
      return;
    }

    const controller = new AbortController();
    setSearchStatus('loading');
    setErrorMessage('');

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/address-autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            sessionToken,
            language: i18n.resolvedLanguage || i18n.language || 'en',
          }),
          signal: controller.signal,
        });
        const payload = await res.json();

        if (res.ok && payload.success && Array.isArray(payload.suggestions)) {
          setSuggestions(payload.suggestions);
          setSearchStatus('success');
          return;
        }

        setSuggestions([]);
        setSearchStatus('error');
        setErrorMessage(t('menuPage.addressSearchFailed'));
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setSuggestions([]);
        setSearchStatus('error');
        setErrorMessage(t('menuPage.addressSearchFailed'));
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [i18n.language, i18n.resolvedLanguage, isOpen, query, sessionToken, t]);

  if (!isOpen) return null;

  const selectSuggestion = async (suggestion: AddressSuggestion) => {
    setSelectingPlaceId(suggestion.placeId);
    setErrorMessage('');

    try {
      const res = await fetch('/api/address-place-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken,
          language: i18n.resolvedLanguage || i18n.language || 'en',
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success || !payload.address) {
        throw new Error(t('menuPage.addressDetailsFailed'));
      }
      onConfirm(String(payload.address), undefined, suggestion.mainText || payload.displayName || suggestion.fullText);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('menuPage.addressDetailsFailed'));
      setSelectingPlaceId('');
    }
  };

  return (
    <div className="fixed inset-0 z-[130] mx-auto max-w-md bg-black/35 backdrop-blur-[2px]">
      <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] max-h-[94vh] flex-col overflow-hidden rounded-t-[2rem] border border-stone-100 bg-white shadow-2xl animate-slide-up">
        <div className="mx-auto mt-3 h-1.5 w-12 flex-none rounded-full bg-stone-200" />
        <div className="flex items-center justify-between border-b border-stone-200/60 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-400">{t('menuPage.deliveryLocation')}</p>
            <h2 className="serif mt-1 text-xl font-bold text-[#2D2D2D]">{t('menuPage.chooseAddress')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200/70 bg-white text-stone-500 shadow-sm transition active:scale-95"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 no-scrollbar">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('menuPage.addressSearchPlaceholder')}
              className="h-14 w-full rounded-2xl border border-stone-200/70 bg-white pl-11 pr-4 text-sm text-[#2D2D2D] shadow-sm outline-none transition focus:border-[#C8A97E]"
              autoFocus
            />
          </div>

          {requireSelection && !address.trim() && (
            <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
              {t('menuPage.addressRequiredForCheckout')}
            </p>
          )}

          {address.trim() && !query.trim() && (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
              <p className="font-bold">{t('menuPage.selectedAddress')}</p>
              <p className="mt-1">{address}</p>
            </div>
          )}

          {query.trim().length >= 2 && (
            <div className="mt-5 space-y-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{t('menuPage.searchResults')}</p>
              {searchStatus === 'loading' && (
                <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-4 py-4 text-xs text-stone-500">
                  <Loader2 size={15} className="animate-spin" />
                  {t('menuPage.addressSearching')}
                </div>
              )}
              {searchStatus === 'error' && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-600">
                  {errorMessage || t('menuPage.addressSearchFailed')}
                </div>
              )}
              {searchStatus === 'success' && suggestions.length === 0 && (
                <div className="rounded-2xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
                  {t('menuPage.addressNoResults')}
                </div>
              )}
              <div className="divide-y divide-stone-100">
              {suggestions.map(suggestion => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  disabled={Boolean(selectingPlaceId)}
                  className="flex w-full items-start gap-3 bg-white py-4 text-left transition active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-stone-50 text-[#C8A97E]">
                    {selectingPlaceId === suggestion.placeId ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#2D2D2D]">{suggestion.mainText || suggestion.fullText}</span>
                    {suggestion.secondaryText && <span className="mt-1 block text-xs leading-5 text-stone-500">{suggestion.secondaryText}</span>}
                  </span>
                </button>
              ))}
              </div>
              <p className="px-1 pt-1 text-[10px] font-bold text-stone-400">{t('menuPage.poweredByGoogle')}</p>
            </div>
          )}

          {filteredAddresses.length > 0 && (
            <div className="mt-5">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{t('menuPage.savedAddresses')}</p>
              <div className="mt-2 divide-y divide-stone-100">
              {filteredAddresses.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onConfirm(item.address, item, item.label)}
                  className="flex w-full items-start gap-3 bg-white py-4 text-left transition active:scale-[0.99]"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-stone-50 text-[#C8A97E]">
                    <MapPin size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold text-[#2D2D2D]">
                      {item.label}
                      {item.isDefault && <span className="rounded-full bg-[#C8A97E]/10 px-2 py-0.5 text-[10px] text-[#C8A97E]">{t('common.default')}</span>}
                    </span>
                    <span className="mt-1 block text-[11px] text-stone-400">{item.recipientName} · {item.phone}</span>
                    <span className="mt-2 block text-xs leading-5 text-stone-600">{item.address}</span>
                  </span>
                  {address.trim() === item.address.trim() && <Check size={17} className="mt-1 flex-none text-[#C8A97E]" />}
                </button>
              ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function createSessionToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getAddressTitle(address: string, addressLabel?: string) {
  const label = String(addressLabel || '').trim();
  if (label) return label;
  const value = address.trim();
  if (!value) return '';
  return value.split(',')[0]?.trim() || value;
}
