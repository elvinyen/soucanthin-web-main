
import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, ShoppingBag, ShoppingCart, ReceiptText, User, Phone, Hash, MapPin, MessageSquare, ArrowLeft, ChevronRight, Upload, Download, WalletCards, CreditCard, Copy, CheckCircle2, Bike, Utensils, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CartLine } from '../data/menu';
import { Order, OrderType, PaymentMethod, ReceiptImage } from '../types/order';
import type { AuthMeResponse } from '../types/auth';
import { AddressSelectionDrawer } from './OrderPreferenceControls';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  tableNumber: string | null;
  orderType: OrderType;
  setOrderType: React.Dispatch<React.SetStateAction<OrderType>>;
  tableNo: string;
  setTableNo: React.Dispatch<React.SetStateAction<string>>;
  address: string;
  setAddress: React.Dispatch<React.SetStateAction<string>>;
  addressLabel: string;
  setAddressLabel: React.Dispatch<React.SetStateAction<string>>;
  setAddressId: React.Dispatch<React.SetStateAction<string>>;
  session: AuthMeResponse;
  onOrderSuccess: () => void;
  onRefreshSession: () => Promise<void>;
  onWalletRecharge: () => void;
}

type CheckoutStep = 'summary' | 'details';
type NotificationStatus = 'sent' | 'failed';
type PaymentConfig = {
  tng: {
    accountName: string;
    accountNumber: string;
    qrImageUrl: string;
  };
};
type DeliveryQuote = {
  deliveryFee: number;
  distanceKm: number;
  durationMin: number;
  deliverable: true;
};
type DeliveryQuoteStatus = 'idle' | 'loading' | 'success' | 'error';

const isValidPhone = (value: string) => /^[0-9+\-\s()]{8,20}$/.test(value.trim());
const ONLINE_PAYMENT_ENABLED = false;
const checkoutCard = 'rounded-3xl border border-stone-100 bg-white p-5 shadow-sm';
const checkoutTitle = 'text-sm font-semibold text-[#2D2D2D]';
const checkoutInput = 'h-12 w-full rounded-2xl border border-stone-200/70 bg-white pl-11 pr-4 text-sm text-[#2D2D2D] outline-none transition placeholder:text-xs placeholder:text-stone-400 focus:border-stone-400/80';
const checkoutHelp = 'text-xs leading-5 text-stone-500';
const checkoutError = 'px-2 text-[11px] leading-4 text-red-500';
const buttonSeparator = <span className="h-4 w-[2px] rounded-full bg-white/60" aria-hidden="true" />;

const Cart: React.FC<CartProps> = ({
  isOpen,
  onClose,
  cart,
  setCart,
  tableNumber,
  orderType,
  setOrderType,
  tableNo,
  setTableNo,
  address,
  setAddress,
  addressLabel,
  setAddressLabel,
  setAddressId,
  session,
  onOrderSuccess,
  onRefreshSession,
  onWalletRecharge,
}) => {
  const { t } = useTranslation();
  const hasScannedTable = Boolean(tableNumber?.trim());
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [isOrdering, setIsOrdering] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isTableLocked, setIsTableLocked] = useState(false);
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [deliveryQuoteStatus, setDeliveryQuoteStatus] = useState<DeliveryQuoteStatus>('idle');
  const [deliveryQuoteError, setDeliveryQuoteError] = useState('');
  const [deliveryUnit, setDeliveryUnit] = useState('');
  const [deliveryInstruction, setDeliveryInstruction] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');
  const [successName, setSuccessName] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>('sent');
  const [successPaymentMethod, setSuccessPaymentMethod] = useState<PaymentMethod>('wallet');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setStep('summary'); // Reset to first step when opening
      setShowSuccess(false); // Reset success state
      setSubmitError('');
      setAttemptedSubmit(false);
      setSelectedCouponId('');
      setIsReceiptPreviewOpen(false);
      setReceiptFile(null);
      setReceiptPreview('');
      setDeliveryInstruction('');
      setDeliveryUnit('');
      setDeliveryQuote(null);
      setDeliveryQuoteStatus('idle');
      setDeliveryQuoteError('');
      setPaymentMethod('wallet');
      if (session.user) {
        setName(session.user.name || '');
        setPhone(session.user.displayPhone || '');
        const defaultAddress = (session.addresses || []).find(item => item.isDefault);
        if (defaultAddress) {
          setName(defaultAddress.recipientName);
          setPhone(defaultAddress.phone);
          if (!address.trim()) {
            setAddress(defaultAddress.address);
            setAddressLabel(defaultAddress.label || '');
            setAddressId(defaultAddress.id);
          }
        }
      }
      
      const scannedTableNo = tableNumber?.trim();
      if (scannedTableNo) {
        setTableNo(scannedTableNo);
        setIsTableLocked(true);
        setOrderType('dinein');
      } else if (!tableNo.trim()) {
        setIsTableLocked(false);
      }
    }
  }, [isOpen, tableNumber]);

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/payment-config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPaymentConfig({ tng: data.tng });
        }
      })
      .catch(() => {
        setPaymentConfig({ tng: { accountName: '', accountNumber: '', qrImageUrl: '' } });
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || orderType !== 'takeaway') {
      setDeliveryQuote(null);
      setDeliveryQuoteStatus('idle');
      setDeliveryQuoteError('');
      return;
    }

    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
      setDeliveryQuote(null);
      setDeliveryQuoteStatus('idle');
      setDeliveryQuoteError('');
      return;
    }

    const controller = new AbortController();
    setDeliveryQuoteStatus('loading');
    setDeliveryQuote(null);
    setDeliveryQuoteError('');

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/delivery-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: normalizedAddress }),
          signal: controller.signal,
        });
        const payload = await res.json();

        if (res.ok && payload.success && payload.deliverable) {
          setDeliveryQuote({
            deliveryFee: Number(payload.deliveryFee || 0),
            distanceKm: Number(payload.distanceKm || 0),
            durationMin: Number(payload.durationMin || 0),
            deliverable: true,
          });
          setDeliveryQuoteStatus('success');
          return;
        }

        setDeliveryQuoteStatus('error');
        setDeliveryQuoteError(payload.error || t('cart.validation.deliveryQuoteFailed'));
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setDeliveryQuoteStatus('error');
        setDeliveryQuoteError(t('cart.validation.deliveryQuoteFailed'));
      }
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, isOpen, orderType, t]);

  const handleAnimationEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
      setShowSuccess(false);
    }
  };

  const cartItems = cart;

  const subtotal = cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const deliveryFee = orderType === 'takeaway' ? deliveryQuote?.deliveryFee || 0 : 0;
  const serviceCharge = 0;
  const total = subtotal + deliveryFee + serviceCharge;
  const availableCoupons = (session.coupons || []).filter(coupon => {
    if (coupon.status !== 'available') return false;
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return false;
    return coupon.discountAmount > 0;
  });
  const selectedCoupon = availableCoupons.find(coupon => coupon.id === selectedCouponId);
  const discountAmount = Math.min(selectedCoupon?.discountAmount || 0, total);
  const payableTotal = Math.max(total - discountAmount, 0);
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const walletBalance = session.wallet?.balance || 0;
  const walletAfterPayment = walletBalance - payableTotal;
  const walletInsufficient = paymentMethod === 'wallet' && session.authenticated && walletBalance < payableTotal;

  const getValidationMessage = () => {
    if (cartItems.length === 0) return t('cart.validation.minItem');
    if (!name.trim()) return t('cart.validation.name');
    if (!phone.trim()) return t('cart.validation.phone');
    if (!isValidPhone(phone)) return t('cart.validation.phoneFormat');
    if (orderType === 'dinein' && !tableNo.trim()) return t('cart.validation.table');
    if (orderType === 'takeaway' && !address.trim()) return t('cart.validation.address');
    if (orderType === 'takeaway' && deliveryQuoteStatus === 'loading') return t('cart.validation.deliveryQuoteLoading');
    if (orderType === 'takeaway' && deliveryQuoteStatus === 'error') return deliveryQuoteError || t('cart.validation.deliveryQuoteFailed');
    if (orderType === 'takeaway' && !deliveryQuote) return t('cart.validation.deliveryQuoteRequired');
    if (paymentMethod === 'tng' && !receiptFile) return t('cart.validation.receipt');
    if (paymentMethod === 'wallet' && !session.authenticated) return t('cart.validation.walletLogin');
    return '';
  };

  const validationMessage = getValidationMessage();
  const isFormValid = !validationMessage;

  const updateQuantity = (lineId: string, delta: number) => {
    setCart(prev => {
      const currentLine = prev.find(item => item.lineId === lineId);
      if (!currentLine) return prev;
      const current = currentLine.quantity;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        return prev.filter(item => item.lineId !== lineId);
      }
      return prev.map(item => item.lineId === lineId ? { ...item, quantity: next } : item);
    });
  };

  const handleNextStep = () => {
    if (cartItems.length > 0) {
      if (orderType === 'takeaway' && !address.trim()) {
        setIsAddressDrawerOpen(true);
        return;
      }
      setStep('details');
    }
  };

  const handleBackStep = () => {
    setStep('summary');
  };

  const handleReceiptChange = (file: File | null) => {
    setReceiptFile(file);
    setReceiptPreview(file ? URL.createObjectURL(file) : '');
    setIsReceiptPreviewOpen(false);
  };

  const buildReceiptImage = async (): Promise<ReceiptImage | undefined> => {
    if (!receiptFile) return undefined;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(t('cart.validation.readReceipt')));
      reader.readAsDataURL(receiptFile);
    });

    return {
      fileName: receiptFile.name,
      mimeType: receiptFile.type,
      dataBase64: dataUrl.split(',')[1] || '',
    };
  };

  const resetCheckoutForm = () => {
    setCart([]);
    setName('');
    setPhone('');
    setTableNo('');
    setDeliveryQuote(null);
    setDeliveryQuoteStatus('idle');
    setDeliveryQuoteError('');
    setDeliveryUnit('');
    setDeliveryInstruction('');
    setReceiptFile(null);
    setReceiptPreview('');
    setIsReceiptPreviewOpen(false);
    setSelectedCouponId('');
    setSubmitError('');
    setAttemptedSubmit(false);
  };

  const handlePlaceOrder = async () => {
    setAttemptedSubmit(true);
    setSubmitError('');

    if (walletInsufficient) {
      onWalletRecharge();
      return;
    }

    if (!isFormValid) {
      setSubmitError(validationMessage);
      return;
    }

    setIsOrdering(true);

    let receiptImage: ReceiptImage | undefined;

    try {
      receiptImage = await buildReceiptImage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('cart.validation.readReceipt'));
      return;
    }

    const takeawayNote = [
      deliveryUnit.trim() ? `${t('cart.deliveryUnitLabel')}: ${deliveryUnit.trim()}` : '',
      deliveryInstruction.trim(),
    ].filter(Boolean).join('\n');

    const orderData: Order = {
      orderType,
      paymentMethod,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
      },
      ...(orderType === 'dinein' 
        ? { dineIn: { tableNo: tableNo.trim() } } 
        : { takeaway: { address: address.trim(), note: takeawayNote || undefined } }
      ),
      items: cartItems.map(item => ({
        id: item.itemId.toString(),
        code: item.code,
        name: item.name,
        basePrice: item.basePrice,
        optionsTotal: item.optionsTotal,
        price: item.unitPrice,
        qty: item.quantity,
        options: item.selectedOptions,
        note: item.note,
      })),
      subtotal: Number(subtotal.toFixed(2)),
      deliveryFee: Number(deliveryFee.toFixed(2)),
      serviceCharge: Number(serviceCharge.toFixed(2)),
      total: Number(total.toFixed(2)),
      couponId: selectedCouponId || undefined,
      discountAmount: Number(discountAmount.toFixed(2)),
      payableTotal: Number(payableTotal.toFixed(2)),
      receiptImage,
      note: takeawayNote || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      const endpoint = paymentMethod === 'stripe' ? '/api/stripe-checkout' : '/api/order';
      const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(orderData)
        });

      const responseText = await res.text();
      const response = responseText ? JSON.parse(responseText) : {};
      
      if (res.ok && response.success) {
        if (paymentMethod === 'stripe') {
          window.location.href = response.checkoutUrl;
          return;
        }

        setLastOrderId(response.orderId);
        setNotificationStatus(response.notificationStatus || 'sent');
        setSuccessPaymentMethod(paymentMethod);
        setShowSuccess(true);
        setSuccessName(name.trim());
        resetCheckoutForm();
        await onRefreshSession();
        // onOrderSuccess will be called when user closes the success modal
      } else {
        setSubmitError(response.error || t('cart.validation.submitFailed', { status: res.status }));
      }
    } catch (error) {
      console.error('Order submission error:', error);
      setSubmitError(error instanceof SyntaxError ? t('cart.validation.serverFormat') : t('cart.validation.network'));
    } finally {
      setIsOrdering(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    onOrderSuccess();
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] transition-all duration-500 max-w-md mx-auto ${isOpen ? 'visible' : 'invisible'}`}
      onTransitionEnd={handleAnimationEnd}
    >
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={showSuccess ? undefined : onClose}
      />

      <div 
        className={`absolute bottom-0 left-0 right-0 bg-[#FAFAFA] rounded-t-[2.5rem] shadow-2xl transition-transform duration-500 ease-out overflow-hidden flex flex-col max-h-[94vh] ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {showSuccess ? (
          <div className="flex-grow flex flex-col items-center justify-center px-8 py-20 animate-fade-in text-center">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-20" />
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <ShoppingBag size={32} />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold serif text-[#2D2D2D] mb-2">{t('cart.successTitle')}</h2>
            <p className="text-stone-400 text-sm mb-8">
              {successPaymentMethod === 'tng'
                ? t('cart.successTng', { name: successName || t('common.fallbackCustomer') })
                : t('cart.successDefault', { name: successName || t('common.fallbackCustomer') })}
            </p>
            
            <div className="w-full bg-stone-50 rounded-3xl p-6 border border-stone-100 space-y-4 mb-10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 uppercase tracking-widest">{t('cart.orderNo')}</span>
                <span className="font-mono font-bold text-[#2D2D2D]">{lastOrderId}</span>
              </div>
              <div className="h-px bg-stone-200/50" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 uppercase tracking-widest">{t('cart.estimatedTime')}</span>
                <span className="font-bold text-[#C8A97E]">{t('cart.estimatedMinutes')}</span>
              </div>
              {notificationStatus === 'failed' && (
                <>
                  <div className="h-px bg-stone-200/50" />
                  <p className="text-left text-[11px] leading-5 text-amber-600">
                    {t('cart.notificationFailed')}
                  </p>
                </>
              )}
            </div>

            <button 
              onClick={handleCloseSuccess}
              className="w-full py-5 bg-[#2D2D2D] text-white rounded-full font-bold text-base tracking-widest shadow-xl active:scale-95 transition-all"
            >
              {t('cart.viewMyOrders')}
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 flex-none" />

            <div className="relative px-8 pt-6 pb-4 flex items-center justify-between flex-none">
              <div className="flex w-10 items-center justify-start">
                {step === 'details' && (
                  <button 
                    onClick={handleBackStep}
                    className="p-2 -ml-2 text-stone-400 hover:text-[#2D2D2D] transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
              </div>
              <div className="pointer-events-none absolute left-1/2 top-6 flex -translate-x-1/2 items-center justify-center gap-3">
                {step === 'summary' ? (
                  <ShoppingCart size={20} className="text-[#C8A97E]" />
                ) : (
                  <ReceiptText size={20} className="text-[#C8A97E]" />
                )}
                <h2 className="text-xl font-semibold text-[#2D2D2D]">
                  {step === 'summary' ? t('cart.cart') : t('cart.checkout')}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 bg-stone-100 text-stone-500 rounded-full hover:bg-stone-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto px-6 pb-36 no-scrollbar">
              {cartItems.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center text-stone-300">
                    <ShoppingBag size={32} />
                  </div>
                  <p className="text-stone-400 text-sm">{t('cart.empty')}</p>
                </div>
              ) : (
                <div className="space-y-8 py-4">
                  {step === 'summary' ? (
                    <section className="space-y-6 animate-fade-in">
                      <h3 className="text-xs font-bold text-stone-400 tracking-[0.2em] uppercase">{t('cart.selectedDetails')} ( {totalItems} )</h3>
                      <div>
                        {cartItems.map(item => (
                          <div key={item.lineId} className="flex items-center space-x-4 border-b border-stone-200/80 py-4 first:pt-0 last:border-b-0 last:pb-0 group">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 flex-none shadow-sm">
                              <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div className="flex-grow">
                              <h4 className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[#2D2D2D]">
                                {item.code && (
                                  <span className="rounded-full bg-stone-100 px-2 py-0.5 font-sans text-[10px] font-semibold leading-4 text-stone-500">
                                    {item.code}
                                  </span>
                                )}
                                <span>{item.name}</span>
                              </h4>
                              <ItemCustomization item={item} />
                              <div className="text-xs font-medium text-[#C8A97E] mt-1">RM {item.unitPrice.toFixed(2)}</div>
                            </div>
                            <div className="flex items-center space-x-3 rounded-full bg-white/70 p-1">
                              <button 
                                onClick={() => updateQuantity(item.lineId, -1)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 active:scale-90 transition-all"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-sm font-bold w-4 text-center text-[#2D2D2D]">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.lineId, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2D2D2D] text-white active:scale-90 transition-all"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                    </section>
                  ) : (
                    <section className="space-y-4 animate-fade-in">
                      <div className={checkoutCard}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3 className={checkoutTitle}>{t('cart.orderContent')}</h3>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-500">{t('common.pieces', { count: totalItems })}</span>
                        </div>
                        <div className="divide-y divide-stone-100/80">
                          {cartItems.map(item => (
                            <div key={item.lineId} className="py-3 first:pt-0 last:pb-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="min-w-0 text-sm leading-5 text-[#2D2D2D]">
                                    {item.code && (
                                      <span className="mr-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium leading-4 text-stone-500">{item.code}</span>
                                    )}
                                    <span>{item.name}</span>
                                    <span className="ml-2 text-xs text-stone-400">x{item.quantity}</span>
                                  </p>
                                  <ItemCustomization item={item} />
                                </div>
                                <p className="flex-none text-right text-sm text-stone-600">RM {(item.unitPrice * item.quantity).toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 space-y-2 border-t border-stone-100/80 pt-4 text-xs">
                          <PriceLine label={t('common.subtotal')} value={subtotal} />
                          <PriceLine
                            label={t('common.deliveryFee')}
                            value={deliveryFee}
                            muted={orderType === 'dinein' ? t('cart.takeaway') : orderType === 'takeaway' && !deliveryQuote ? t('cart.deliveryQuotePending') : undefined}
                          />
                          {discountAmount > 0 && <PriceLine label={t('common.discount')} value={-discountAmount} highlight />}
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium text-[#2D2D2D]">{t('common.total')}</span>
                            <span className="text-lg font-semibold text-[#C8A97E]">RM {payableTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={checkoutCard}>
                        <h3 className={checkoutTitle}>{t('cart.orderMethod')}</h3>
                        <div className="mt-4 space-y-4">
                          <div className="grid rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                            <div className="grid grid-cols-2">
                              {(['takeaway', 'dinein'] as OrderType[]).map((type) => {
                                const active = orderType === type;
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                      setOrderType(type);
                                      if (type === 'takeaway' && !address.trim()) setIsAddressDrawerOpen(true);
                                    }}
                                    className={`flex h-9 items-center justify-center gap-1.5 rounded-full transition-all active:scale-[0.98] ${
                                      active
                                        ? 'bg-[#3A3A3A] text-white shadow-sm'
                                        : 'text-stone-500'
                                    }`}
                                  >
                                    {type === 'takeaway' ? <Bike size={14} /> : <Utensils size={14} />}
                                    <span>{type === 'takeaway' ? t('cart.takeaway') : t('cart.dineIn')}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {hasScannedTable && orderType === 'dinein' && (
                            <p className={checkoutHelp}>{t('cart.tableDetected')}</p>
                          )}
                          {orderType === 'dinein' ? (
                            <div className="space-y-3 rounded-2xl bg-stone-50/70 p-3">
                              <div className="relative animate-fade-in">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder={t('cart.tableNo')}
                                    value={tableNo}
                                    onChange={(e) => setTableNo(e.target.value)}
                                    disabled={isTableLocked}
                                    className={`${checkoutInput} ${isTableLocked ? 'cursor-not-allowed text-stone-500' : ''}`}
                                  />
                                  {isTableLocked && (
                                    <button
                                      type="button"
                                      onClick={() => setIsTableLocked(false)}
                                      className="flex-none rounded-2xl border border-stone-200/70 bg-white px-4 text-xs font-semibold text-stone-600 transition active:scale-[0.98]"
                                    >
                                      {t('common.edit')}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {attemptedSubmit && !tableNo.trim() && <p className={checkoutError}>{t('cart.validation.table')}</p>}
                            </div>
                          ) : (
                            <div className="space-y-3 rounded-2xl bg-stone-50/70 p-3">
                              <button
                                type="button"
                                onClick={() => setIsAddressDrawerOpen(true)}
                                className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-stone-100 bg-white px-3 py-2 text-left transition active:scale-[0.99]"
                              >
                                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-stone-100 text-stone-500">
                                  <MapPin size={16} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate ${address ? 'text-sm font-semibold text-[#2D2D2D]' : 'text-xs font-medium text-stone-400'}`}>{addressLabel || (address ? address.split(',')[0] : t('menuPage.chooseAddress'))}</span>
                                  <span className="mt-0.5 block truncate text-[11px] text-stone-400">{address ? t('cart.tapToChangeAddress') : t('cart.addressRequiredHint')}</span>
                                </span>
                                <ChevronRight size={17} className="flex-none text-stone-300" />
                              </button>
                              {attemptedSubmit && !address.trim() && <p className={checkoutError}>{t('cart.validation.address')}</p>}
                              <div className="relative rounded-2xl border border-stone-100 bg-white">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                                <input
                                  type="text"
                                  placeholder={t('cart.deliveryUnitPlaceholder')}
                                  value={deliveryUnit}
                                  maxLength={80}
                                  onChange={(e) => setDeliveryUnit(e.target.value.slice(0, 80))}
                                  className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-[#2D2D2D] outline-none transition placeholder:text-xs placeholder:text-stone-400"
                                />
                              </div>
                              <div className="relative rounded-2xl border border-stone-100 bg-white">
                                <MessageSquare className="absolute left-3.5 top-3.5 text-stone-300" size={16} />
                                <textarea
                                  placeholder={t('cart.deliveryInstructionPlaceholder')}
                                  value={deliveryInstruction}
                                  maxLength={100}
                                  onChange={(e) => setDeliveryInstruction(e.target.value.slice(0, 100))}
                                  rows={2}
                                  className="w-full resize-none bg-transparent py-3 pl-10 pr-12 text-sm text-[#2D2D2D] outline-none transition placeholder:text-xs placeholder:text-stone-400"
                                />
                                <span className="absolute bottom-3 right-2 text-[10px] text-stone-400">{deliveryInstruction.length}/100</span>
                              </div>
                              {address.trim() && (
                                <div className={`rounded-2xl px-4 py-3 text-xs leading-5 ${
                                  deliveryQuoteStatus === 'success'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : deliveryQuoteStatus === 'error'
                                      ? 'bg-red-50 text-red-600'
                                      : 'bg-stone-50 text-stone-500'
                                }`}>
                                  {deliveryQuoteStatus === 'loading' && t('cart.deliveryQuoteLoading')}
                                  {deliveryQuoteStatus === 'success' && deliveryQuote && (
                                    <span>{t('cart.deliveryQuoteReady', {
                                      fee: deliveryQuote.deliveryFee.toFixed(2),
                                      distance: deliveryQuote.distanceKm.toFixed(2),
                                      minutes: deliveryQuote.durationMin,
                                    })}</span>
                                  )}
                                  {deliveryQuoteStatus === 'error' && (deliveryQuoteError || t('cart.validation.deliveryQuoteFailed'))}
                                  {deliveryQuoteStatus === 'idle' && t('cart.deliveryQuoteIdle')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={checkoutCard}>
                        <h3 className={checkoutTitle}>{t('cart.detailsTitle')}</h3>
                        <div className="mt-4 space-y-3">
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                            <input
                              type="text"
                              placeholder={t('cart.name')}
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className={checkoutInput}
                            />
                          </div>
                          {attemptedSubmit && !name.trim() && <p className={checkoutError}>{t('cart.validation.name')}</p>}
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                            <input
                              type="tel"
                              placeholder={t('cart.phone')}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className={checkoutInput}
                            />
                          </div>
                          {attemptedSubmit && phone.trim() && !isValidPhone(phone) && <p className={checkoutError}>{t('cart.validation.phoneFormat')}</p>}
                          {attemptedSubmit && !phone.trim() && <p className={checkoutError}>{t('cart.validation.phone')}</p>}
                        </div>
                      </div>

                      <div className={checkoutCard}>
                        <h3 className={checkoutTitle}>{t('cart.paymentMethod')}</h3>
                        <div className={`mt-4 grid gap-2 ${ONLINE_PAYMENT_ENABLED ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <PaymentTab active={paymentMethod === 'wallet'} icon={<WalletCards size={16} />} label="Wallet" onClick={() => setPaymentMethod('wallet')} />
                          <PaymentTab active={paymentMethod === 'tng'} icon={<WalletCards size={16} />} label="Touch 'n Go" onClick={() => setPaymentMethod('tng')} />
                          {ONLINE_PAYMENT_ENABLED && (
                            <PaymentTab active={paymentMethod === 'stripe'} icon={<CreditCard size={16} />} label={t('cart.onlinePayment')} onClick={() => setPaymentMethod('stripe')} />
                          )}
                        </div>

                        {paymentMethod === 'wallet' && (
                          <div className="mt-4 space-y-3 rounded-2xl bg-stone-50 p-4 text-xs">
                            <PriceLine label={t('cart.walletBalance')} value={walletBalance} />
                            <PriceLine label={t('cart.thisPayment')} value={payableTotal} />
                            <PriceLine label={t('cart.balanceAfter')} value={Math.max(walletAfterPayment, 0)} highlight={walletInsufficient} />
                            {walletInsufficient && <p className="text-[11px] leading-5 text-amber-700">{t('cart.walletInsufficient')}</p>}
                          </div>
                        )}

                        {paymentMethod === 'tng' && (
                          <div className="mt-4 space-y-3 rounded-2xl bg-stone-50 p-4">
                            <div className="rounded-2xl bg-white p-3 text-[11px] leading-5 text-stone-500">
                              <p>{t('cart.tngStepTransfer')}</p>
                              <p>{t('cart.tngStepVerify')}</p>
                              <p>{t('cart.tngStepUpload')}</p>
                            </div>
                            <div className="flex justify-between gap-4 text-xs">
                              <span className="text-stone-500">{t('cart.payee')}</span>
                              <span className="font-semibold text-[#2D2D2D]">{paymentConfig?.tng.accountName || 'Soup Can Thin'}</span>
                            </div>
                            {paymentConfig?.tng.qrImageUrl ? (
                              <div className="space-y-3 rounded-2xl bg-white p-3">
                                <img
                                  src={paymentConfig.tng.qrImageUrl}
                                  alt={t('cart.tngQrCode')}
                                  className="mx-auto aspect-square w-full max-w-56 object-contain"
                                />
                                <a
                                  href={paymentConfig.tng.qrImageUrl}
                                  download
                                  className="flex h-10 items-center justify-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 text-xs font-medium text-stone-600 active:scale-[0.99]"
                                >
                                  <Download size={14} />
                                  <span>{t('cart.downloadTngQr')}</span>
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-stone-500">{t('cart.tngAccount')}</span>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard?.writeText(paymentConfig?.tng.accountNumber || '0123456789')}
                                  className="flex items-center gap-1 font-mono font-semibold text-[#2D2D2D]"
                                >
                                  {paymentConfig?.tng.accountNumber || '0123456789'}
                                  <Copy size={13} className="text-[#C8A97E]" />
                                </button>
                              </div>
                            )}
                            <label className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C8A97E]/70 bg-white px-4 py-4 text-xs font-semibold text-[#C8A97E] active:scale-[0.99]">
                              {receiptFile ? <CheckCircle2 size={16} /> : <Upload size={16} />}
                              <span className="min-w-0 truncate">{receiptFile ? receiptFile.name : t('cart.uploadReceipt')}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg"
                                className="hidden"
                                onChange={(event) => handleReceiptChange(event.target.files?.[0] || null)}
                              />
                            </label>
                            {receiptPreview && (
                              <button
                                type="button"
                                onClick={() => setIsReceiptPreviewOpen(true)}
                                className="h-40 w-full overflow-hidden rounded-2xl bg-white p-2 active:scale-[0.99]"
                                aria-label={t('cart.receiptPreviewAria')}
                              >
                                <img src={receiptPreview} alt={t('cart.receiptPreviewAlt')} className="h-full w-full object-contain" />
                              </button>
                            )}
                          </div>
                        )}

                        {ONLINE_PAYMENT_ENABLED && paymentMethod === 'stripe' && (
                          <div className="mt-4 rounded-2xl bg-stone-50 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[#2D2D2D]">{t('cart.onlinePayment')}</p>
                                <p className={checkoutHelp}>Powered by Stripe</p>
                              </div>
                              <CreditCard className="text-[#C8A97E]" size={22} />
                            </div>
                          </div>
                        )}
                      </div>

                      {availableCoupons.length > 0 && (
                        <div className={checkoutCard}>
                          <h3 className={checkoutTitle}>{t('cart.coupon')}</h3>
                          <select
                            value={selectedCouponId}
                            onChange={(event) => setSelectedCouponId(event.target.value)}
                            className="mt-4 h-12 w-full rounded-2xl border border-stone-200/70 bg-white px-4 text-sm text-[#2D2D2D] outline-none focus:border-stone-400/80"
                          >
                            <option value="">{t('cart.noCoupon')}</option>
                            {availableCoupons.map(coupon => (
                              <option key={coupon.id} value={coupon.id}>
                                {coupon.title} - RM {coupon.discountAmount.toFixed(2)}
                              </option>
                            ))}
                          </select>
                          {discountAmount > 0 && (
                            <p className="mt-3 text-[11px] leading-5 text-emerald-600">
                              {t('cart.couponApplied', { discount: discountAmount.toFixed(2), total: payableTotal.toFixed(2) })}
                            </p>
                          )}
                        </div>
                      )}

                      {submitError && (
                        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600">
                          {submitError}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Bar Action Button */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-stone-100 bg-white/90 p-5 shadow-[0_-12px_36px_rgba(45,45,45,0.06)] backdrop-blur-xl">
              {step === 'summary' ? (
                <button 
                  onClick={handleNextStep}
                  disabled={cartItems.length === 0}
                  className={`flex w-full items-center justify-center gap-3 rounded-full py-4 text-sm font-semibold transition-all ${
                    cartItems.length === 0
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                      : 'bg-[#2D2D2D] text-white active:scale-95'
                  }`}
                >
                  <span>{t('cart.totalAmount', { amount: subtotal.toFixed(2) })}</span>
                  {buttonSeparator}
                  <span>{t('cart.settle')}</span>
                  <ChevronRight size={18} />
                </button>
              ) : (
                <div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isOrdering || !isFormValid}
                    className={`flex min-h-[3.5rem] w-full items-center justify-center rounded-full px-4 py-4 text-center text-sm font-semibold transition-all ${
                      isOrdering || !isFormValid
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        : 'bg-[#2D2D2D] text-white active:scale-95'
                    }`}
                  >
                    {isOrdering ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>
                        {!isFormValid
                          ? t('cart.fillInfoContinue')
                          : walletInsufficient
                            ? t('cart.topUp')
                            : (
                              <span className="inline-flex items-center justify-center gap-3">
                                <span>{t('cart.totalAmount', { amount: payableTotal.toFixed(2) })}</span>
                                {buttonSeparator}
                                <span>{t('cart.settle')}</span>
                              </span>
                            )}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <AddressSelectionDrawer
        isOpen={isAddressDrawerOpen}
        address={address}
        savedAddresses={session.addresses || []}
        requireSelection={step === 'summary' || step === 'details'}
        onClose={() => setIsAddressDrawerOpen(false)}
        onConfirm={(nextAddress, savedAddress, nextAddressLabel) => {
          setAddress(nextAddress);
          setAddressLabel(nextAddressLabel || '');
          setAddressId(savedAddress?.id || '');
          if (savedAddress) {
            setName(savedAddress.recipientName);
            setPhone(savedAddress.phone);
          }
          setIsAddressDrawerOpen(false);
          if (step === 'summary' && cartItems.length > 0) setStep('details');
        }}
      />
      {receiptPreview && isReceiptPreviewOpen && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/80 p-6" onClick={() => setIsReceiptPreviewOpen(false)}>
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white"
            onClick={() => setIsReceiptPreviewOpen(false)}
            aria-label={t('common.close')}
          >
            <X size={22} />
          </button>
          <img
            src={receiptPreview}
            alt={t('cart.receiptLargeAlt')}
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

function PriceLine({ label, value, muted, highlight }: { label: string; value: number; muted?: string; highlight?: boolean }) {
  const displayValue = `${value < 0 ? '- ' : ''}RM ${Math.abs(value).toFixed(2)}`;
  return (
    <div className={`flex items-center justify-between gap-4 ${highlight ? 'text-emerald-600' : 'text-stone-500'}`}>
      <span>
        {label}
        {muted && <span className="ml-1 text-[10px] text-stone-400">({muted})</span>}
      </span>
      <span className={highlight ? 'text-emerald-600' : 'text-stone-600'}>{displayValue}</span>
    </div>
  );
}

function PaymentTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition-all ${
        active
          ? 'border-[#2D2D2D] bg-[#2D2D2D] text-white'
          : 'border-stone-200/70 bg-white text-stone-500'
      }`}
    >
      {icon}
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}

function ItemCustomization({ item }: { item: CartLine }) {
  const { t } = useTranslation();
  const optionText = item.selectedOptions.length
    ? item.selectedOptions.map(option => `${option.groupName}: ${option.name}`).join(' · ')
    : '';

  if (!optionText && !item.note) return null;

  return (
    <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-stone-400">
      {optionText && <p className="line-clamp-2">{optionText}</p>}
      {item.note && <p className="line-clamp-2">{t('common.note')}：{item.note}</p>}
    </div>
  );
}

export default Cart;
