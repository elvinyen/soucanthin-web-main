
import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, ShoppingBag, User, Phone, MapPin, Hash, MessageSquare, ArrowLeft, ChevronRight, Upload, WalletCards, CreditCard, Copy, CheckCircle2 } from 'lucide-react';
import { CartLine } from '../data/menu';
import { Order, OrderType, PaymentMethod, ReceiptImage } from '../types/order';
import type { AuthMeResponse } from '../types/auth';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  tableNumber: string | null;
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
  };
};

const isValidPhone = (value: string) => /^[0-9+\-\s()]{8,20}$/.test(value.trim());
const TAKEAWAY_DELIVERY_FEE = 12;

const Cart: React.FC<CartProps> = ({ isOpen, onClose, cart, setCart, tableNumber, session, onOrderSuccess, onRefreshSession, onWalletRecharge }) => {
  const hasScannedTable = Boolean(tableNumber?.trim());
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [isOrdering, setIsOrdering] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [isTableLocked, setIsTableLocked] = useState(false);
  const [address, setAddress] = useState('');
  const [deliveryInstruction, setDeliveryInstruction] = useState('');
  const [isDeliveryInstructionOpen, setIsDeliveryInstructionOpen] = useState(false);
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
      setIsDeliveryInstructionOpen(false);
      setPaymentMethod('wallet');
      if (session.user) {
        setName(session.user.name || '');
        setPhone(session.user.displayPhone || '');
        const defaultAddress = (session.addresses || []).find(item => item.isDefault);
        if (defaultAddress) {
          setName(defaultAddress.recipientName);
          setPhone(defaultAddress.phone);
          setAddress(defaultAddress.address);
        }
      }
      
      const scannedTableNo = tableNumber?.trim();
      if (scannedTableNo) {
        setTableNo(scannedTableNo);
        setIsTableLocked(true);
        setOrderType('dinein');
      } else {
        setTableNo('');
        setIsTableLocked(false);
        setOrderType('takeaway');
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
        setPaymentConfig({ tng: { accountName: '', accountNumber: '' } });
      });
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
      setShowSuccess(false);
    }
  };

  const cartItems = cart;

  const subtotal = cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const deliveryFee = orderType === 'takeaway' ? TAKEAWAY_DELIVERY_FEE : 0;
  const serviceCharge = subtotal * 0.06;
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
    if (cartItems.length === 0) return '请先选择至少一件商品';
    if (!name.trim()) return '请填写姓名';
    if (!phone.trim()) return '请填写联系电话';
    if (!isValidPhone(phone)) return '联系电话格式不正确';
    if (orderType === 'dinein' && !tableNo.trim()) return '请填写桌号';
    if (orderType === 'takeaway' && !address.trim()) return '请填写外卖地址';
    if (paymentMethod === 'tng' && !receiptFile) return '请上传 TNG 转账截图';
    if (paymentMethod === 'wallet' && !session.authenticated) return '请先登录后使用钱包支付';
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
      reader.onerror = () => reject(new Error('无法读取付款截图'));
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
    setAddress('');
    setDeliveryInstruction('');
    setIsDeliveryInstructionOpen(false);
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
      setSubmitError(error instanceof Error ? error.message : '无法读取付款截图');
      return;
    }

    const orderData: Order = {
      orderType,
      paymentMethod,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
      },
      ...(orderType === 'dinein' 
        ? { dineIn: { tableNo: tableNo.trim() } } 
        : { takeaway: { address: address.trim(), note: deliveryInstruction.trim() || undefined } }
      ),
      items: cartItems.map(item => ({
        id: item.itemId.toString(),
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
      note: deliveryInstruction.trim() || undefined,
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
        setSubmitError(response.error || `订单提交失败 (${res.status})，请稍后重试。`);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      setSubmitError(error instanceof SyntaxError ? '服务器返回格式异常，请检查本地 API 或后端日志。' : '网络连接异常，请检查后重试。');
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
        className={`absolute bottom-0 left-0 right-0 bg-[#F5F5F5] rounded-t-[2.5rem] shadow-2xl transition-transform duration-500 ease-out overflow-hidden flex flex-col max-h-[94vh] ${
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
            
            <h2 className="text-2xl font-bold serif text-[#2D2D2D] mb-2">订单提交成功！</h2>
            <p className="text-stone-400 text-sm mb-8">
              {successPaymentMethod === 'tng'
                ? `尊敬的 ${successName || '顾客'}，订单已提交，员工将审核您的 TNG 付款截图。`
                : `尊敬的 ${successName || '顾客'}，已收到您的订单。`}
            </p>
            
            <div className="w-full bg-stone-50 rounded-3xl p-6 border border-stone-100 space-y-4 mb-10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 uppercase tracking-widest">订单编号</span>
                <span className="font-mono font-bold text-[#2D2D2D]">{lastOrderId}</span>
              </div>
              <div className="h-px bg-stone-200/50" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 uppercase tracking-widest">预计时间</span>
                <span className="font-bold text-[#C8A97E]">15-25 分钟</span>
              </div>
              {notificationStatus === 'failed' && (
                <>
                  <div className="h-px bg-stone-200/50" />
                  <p className="text-left text-[11px] leading-5 text-amber-600">
                    订单已保存，店员通知暂时未送达。请向柜台出示订单编号。
                  </p>
                </>
              )}
            </div>

            <button 
              onClick={handleCloseSuccess}
              className="w-full py-5 bg-[#2D2D2D] text-white rounded-full font-bold text-base tracking-widest shadow-xl active:scale-95 transition-all"
            >
              查看我的订单 · MY ORDERS
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 flex-none" />

            <div className="px-8 pt-6 pb-4 flex items-center justify-between flex-none">
              <div className="flex items-center space-x-3">
                {step === 'details' && (
                  <button 
                    onClick={handleBackStep}
                    className="p-2 -ml-2 text-stone-400 hover:text-[#2D2D2D] transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold serif text-[#2D2D2D]">
                    {step === 'summary' ? '购物车' : '确认订单'}
                  </h2>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-0.5">
                    {step === 'summary' ? 'Cart Summary' : 'Checkout'}
                  </p>
                </div>
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
                  <p className="text-stone-400 text-sm">购物车已清空</p>
                </div>
              ) : (
                <div className="space-y-8 py-4">
                  {step === 'summary' ? (
                    <section className="space-y-6 animate-fade-in">
                      <h3 className="text-xs font-bold text-stone-400 tracking-[0.2em] uppercase">已选明细 ( {totalItems} )</h3>
                      <div className="space-y-6">
                        {cartItems.map(item => (
                          <div key={item.lineId} className="flex items-center space-x-4 group">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 flex-none shadow-sm">
                              <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div className="flex-grow">
                              <h4 className="text-sm font-bold text-[#2D2D2D] serif">{item.name}</h4>
                              <ItemCustomization item={item} />
                              <div className="text-xs font-bold text-[#C8A97E] mt-1">RM {item.unitPrice.toFixed(2)}</div>
                            </div>
                            <div className="flex items-center space-x-3 bg-stone-50 rounded-full p-1 border border-stone-100">
                              <button 
                                onClick={() => updateQuantity(item.lineId, -1)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-stone-400 active:scale-90 transition-all shadow-sm"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-sm font-bold w-4 text-center text-[#2D2D2D]">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.lineId, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2D2D2D] text-white active:scale-90 transition-all shadow-sm"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-3 mt-8">
                        <div className="flex justify-between text-xs text-stone-400">
                          <span>小计 (Subtotal)</span>
                          <span className="text-[#2D2D2D] font-medium">RM {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-400">
                          <span>配送费</span>
                          <span className="text-[#2D2D2D] font-medium">RM {deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-400">
                          <span>SST (6%)</span>
                          <span className="text-[#2D2D2D] font-medium">RM {serviceCharge.toFixed(2)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600">
                            <span>优惠券</span>
                            <span className="font-medium">- RM {discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="h-px bg-stone-50 my-1" />
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-sm font-bold serif text-[#2D2D2D]">实付金额</span>
                          <span className="text-xl font-bold text-[#C8A97E] serif">RM {payableTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="space-y-6 animate-fade-in">
                      <div className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_18px_55px_rgba(45,45,45,0.08)] backdrop-blur-2xl">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-bold serif text-[#2D2D2D]">订单内容</h3>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-[#C8A97E]">{totalItems} 件</span>
                        </div>
                        <div className="space-y-4">
                          {cartItems.map(item => (
                            <div key={item.lineId} className="flex gap-3">
                              <div className="h-14 w-14 flex-none overflow-hidden rounded-2xl bg-stone-100">
                                <img src={item.image} className="h-full w-full object-cover" alt={item.name} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between gap-3">
                                  <p className="truncate text-sm font-bold text-[#2D2D2D]">{item.name} ×{item.quantity}</p>
                                  <p className="flex-none text-sm font-bold text-[#2D2D2D]">RM {(item.unitPrice * item.quantity).toFixed(2)}</p>
                                </div>
                                <ItemCustomization item={item} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 space-y-2 border-t border-stone-200/60 pt-4 text-xs">
                          <PriceLine label="商品" value={subtotal} />
                          <PriceLine label="配送费" value={deliveryFee} muted={orderType === 'dinein' ? '仅外卖' : undefined} />
                          <PriceLine label="税费" value={serviceCharge} />
                          {discountAmount > 0 && <PriceLine label="优惠" value={-discountAmount} highlight />}
                          <div className="flex items-center justify-between pt-2">
                            <span className="font-bold text-[#2D2D2D]">总计</span>
                            <span className="text-2xl font-bold serif text-[#C8A97E]">RM {payableTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-[0_18px_55px_rgba(45,45,45,0.08)] backdrop-blur-2xl">
                        <h3 className="mb-4 text-sm font-bold serif text-[#2D2D2D]">点单方式</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-full bg-stone-100/80 p-1">
                          <button
                            onClick={() => setOrderType('dinein')}
                            type="button"
                            className={`rounded-full px-3 py-3 text-xs font-bold transition-all ${
                              orderType === 'dinein'
                                ? 'bg-[#2D2D2D] text-white shadow-sm'
                                : 'text-stone-500'
                            }`}
                          >
                            🍽 堂食 Dine-in
                          </button>
                          <button
                            onClick={() => setOrderType('takeaway')}
                            type="button"
                            className={`rounded-full px-3 py-3 text-xs font-bold transition-all ${
                              orderType === 'takeaway'
                                ? 'bg-[#2D2D2D] text-white shadow-sm'
                                : 'text-stone-500'
                            }`}
                          >
                            🥡 外卖 Takeaway
                          </button>
                        </div>
                        {hasScannedTable && orderType === 'dinein' && (
                          <p className="mt-3 text-[11px] leading-5 text-stone-500">已从桌面二维码识别桌号，可在下方修改。</p>
                        )}
                      </div>

                      <div className="rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-[0_18px_55px_rgba(45,45,45,0.08)] backdrop-blur-2xl">
                        <h3 className="mb-4 text-sm font-bold serif text-[#2D2D2D]">填写订单资料</h3>
                        <div className="space-y-3">
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-[#C8A97E] transition-colors" size={16} />
                            <input
                              type="text"
                              placeholder="姓名"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full rounded-2xl border border-white/70 bg-white/70 py-4 pl-11 pr-4 text-sm shadow-inner shadow-white/40 outline-none transition-all focus:border-[#C8A97E]"
                            />
                          </div>
                          {attemptedSubmit && !name.trim() && <p className="-mt-1 px-2 text-[11px] text-red-500">请填写姓名</p>}
                          <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-[#C8A97E] transition-colors" size={16} />
                            <input
                              type="tel"
                              placeholder="手机号（必填）"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full rounded-2xl border border-white/70 bg-white/70 py-4 pl-11 pr-4 text-sm shadow-inner shadow-white/40 outline-none transition-all focus:border-[#C8A97E]"
                            />
                          </div>
                          {attemptedSubmit && phone.trim() && !isValidPhone(phone) && <p className="-mt-1 px-2 text-[11px] text-red-500">联系电话格式不正确</p>}
                          {attemptedSubmit && !phone.trim() && <p className="-mt-1 px-2 text-[11px] text-red-500">请填写联系电话</p>}
                          {orderType === 'dinein' ? (
                            <>
                              <div className="relative group animate-fade-in">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-[#C8A97E] transition-colors" size={16} />
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="请输入桌号"
                                    value={tableNo}
                                    onChange={(e) => setTableNo(e.target.value)}
                                    disabled={isTableLocked}
                                    className={`w-full rounded-2xl border border-white/70 bg-white/70 py-4 pl-11 pr-4 text-sm shadow-inner shadow-white/40 outline-none transition-all focus:border-[#C8A97E] ${
                                      isTableLocked ? 'text-stone-500 cursor-not-allowed' : ''
                                    }`}
                                  />
                                  {isTableLocked && (
                                    <button
                                      type="button"
                                      onClick={() => setIsTableLocked(false)}
                                      className="flex-none rounded-2xl bg-stone-100 px-4 text-xs font-bold text-stone-500 transition-colors active:scale-[0.98]"
                                    >
                                      修改
                                    </button>
                                  )}
                                </div>
                              </div>
                              {attemptedSubmit && !tableNo.trim() && <p className="-mt-1 px-2 text-[11px] text-red-500">请填写桌号</p>}
                            </>
                          ) : (
                            <>
                              <div className="relative group animate-fade-in">
                                <MapPin className="absolute left-4 top-4 text-stone-300 group-focus-within:text-[#C8A97E] transition-colors" size={16} />
                                <textarea
                                  placeholder="地址（必填）"
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                  rows={3}
                                  className="w-full resize-none rounded-2xl border border-white/70 bg-white/70 py-4 pl-11 pr-4 text-sm shadow-inner shadow-white/40 outline-none transition-all focus:border-[#C8A97E]"
                                />
                              </div>
                              {attemptedSubmit && !address.trim() && <p className="-mt-1 px-2 text-[11px] text-red-500">请填写外卖地址</p>}
                              {!isDeliveryInstructionOpen ? (
                                <button
                                  type="button"
                                  onClick={() => setIsDeliveryInstructionOpen(true)}
                                  className="text-xs font-bold text-[#C8A97E]"
                                >
                                  + 添加配送说明
                                </button>
                              ) : (
                                <div className="relative group animate-fade-in">
                                  <MessageSquare className="absolute left-4 top-4 text-stone-300 group-focus-within:text-[#C8A97E] transition-colors" size={16} />
                                  <textarea
                                    placeholder="配送说明（选填），例如：放门口、无需餐具、先电话联系"
                                    value={deliveryInstruction}
                                    maxLength={100}
                                    onChange={(e) => setDeliveryInstruction(e.target.value.slice(0, 100))}
                                    rows={2}
                                    className="w-full resize-none rounded-2xl border border-white/70 bg-white/70 py-4 pl-11 pr-4 text-sm shadow-inner shadow-white/40 outline-none transition-all focus:border-[#C8A97E]"
                                  />
                                  <span className="absolute bottom-3 right-4 text-[10px] text-stone-400">{deliveryInstruction.length}/100</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-[0_18px_55px_rgba(45,45,45,0.08)] backdrop-blur-2xl">
                        <h3 className="mb-4 text-sm font-bold serif text-[#2D2D2D]">支付方式</h3>
                        <div className="grid grid-cols-3 gap-2">
                          <PaymentTab active={paymentMethod === 'wallet'} icon={<WalletCards size={16} />} label="Wallet" onClick={() => setPaymentMethod('wallet')} />
                          <PaymentTab active={paymentMethod === 'tng'} icon={<WalletCards size={16} />} label="TNG" onClick={() => setPaymentMethod('tng')} />
                          <PaymentTab active={paymentMethod === 'stripe'} icon={<CreditCard size={16} />} label="在线支付" onClick={() => setPaymentMethod('stripe')} />
                        </div>

                        {paymentMethod === 'wallet' && (
                          <div className="mt-4 space-y-3 rounded-3xl border border-stone-100 bg-stone-50/80 p-4">
                            <PriceLine label="钱包余额" value={walletBalance} />
                            <PriceLine label="本次消费" value={payableTotal} />
                            <PriceLine label="支付后余额" value={Math.max(walletAfterPayment, 0)} highlight={walletInsufficient} />
                            {walletInsufficient && <p className="text-[11px] leading-5 text-amber-700">余额不足，点击底部按钮前往充值。</p>}
                          </div>
                        )}

                        {paymentMethod === 'tng' && (
                          <div className="mt-4 space-y-3 rounded-3xl border border-stone-100 bg-stone-50/80 p-4">
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-stone-500">收款人</span>
                                <span className="font-bold text-[#2D2D2D]">{paymentConfig?.tng.accountName || 'Soup Can Thin'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-stone-500">TNG账号</span>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard?.writeText(paymentConfig?.tng.accountNumber || '0123456789')}
                                  className="flex items-center gap-1 font-mono font-bold text-[#2D2D2D]"
                                >
                                  {paymentConfig?.tng.accountNumber || '0123456789'}
                                  <Copy size={13} className="text-[#C8A97E]" />
                                </button>
                              </div>
                            </div>
                            <label className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C8A97E]/70 bg-white/80 px-4 py-5 text-xs font-bold text-[#C8A97E] active:scale-[0.99]">
                              {receiptFile ? <CheckCircle2 size={16} /> : <Upload size={16} />}
                              <span className="min-w-0 truncate">{receiptFile ? receiptFile.name : '上传 TNG 转账截图'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg"
                                className="hidden"
                                onChange={(event) => handleReceiptChange(event.target.files?.[0] || null)}
                              />
                            </label>
                            <p className="text-[11px] leading-5 text-stone-500">转账成功后上传截图，订单确认后开始制作。</p>
                            {!receiptFile && <p className="text-[11px] text-amber-700">请上传转账截图</p>}
                            {receiptPreview && (
                              <button
                                type="button"
                                onClick={() => setIsReceiptPreviewOpen(true)}
                                className="h-40 w-full overflow-hidden rounded-2xl border border-white bg-white/80 p-2 active:scale-[0.99]"
                                aria-label="查看TNG付款截图"
                              >
                                <img src={receiptPreview} alt="TNG付款截图预览" className="h-full w-full object-contain" />
                              </button>
                            )}
                          </div>
                        )}

                        {paymentMethod === 'stripe' && (
                          <div className="mt-4 rounded-3xl border border-stone-100 bg-stone-50/80 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-[#2D2D2D]">在线支付</p>
                                <p className="mt-1 text-[11px] text-stone-500">Powered by Stripe</p>
                              </div>
                              <CreditCard className="text-[#C8A97E]" size={22} />
                            </div>
                          </div>
                        )}
                      </div>

                      {availableCoupons.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase">优惠券</h3>
                          <select
                            value={selectedCouponId}
                            onChange={(event) => setSelectedCouponId(event.target.value)}
                            className="w-full rounded-2xl border border-stone-100 bg-white px-4 py-4 text-sm outline-none focus:border-[#C8A97E] shadow-sm"
                          >
                            <option value="">不使用优惠券</option>
                            {availableCoupons.map(coupon => (
                              <option key={coupon.id} value={coupon.id}>
                                {coupon.title} - RM {coupon.discountAmount.toFixed(2)}
                              </option>
                            ))}
                          </select>
                          {discountAmount > 0 && (
                            <p className="text-[11px] leading-5 text-emerald-600">
                              已抵扣 RM {discountAmount.toFixed(2)}，实付 RM {payableTotal.toFixed(2)}
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
            <div className="absolute bottom-0 left-0 right-0 border-t border-white/70 bg-white/80 p-5 shadow-[0_-18px_55px_rgba(45,45,45,0.08)] backdrop-blur-2xl">
              {step === 'summary' ? (
                <button 
                  onClick={handleNextStep}
                  disabled={cartItems.length === 0}
                  className={`w-full py-5 rounded-full font-bold text-base tracking-widest shadow-2xl transition-all flex items-center justify-center space-x-3 ${
                    cartItems.length === 0
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                      : 'bg-[#2D2D2D] text-white active:scale-95 shadow-black/30'
                  }`}
                >
                  <span>填写资料 · CHECKOUT</span>
                  <ChevronRight size={18} />
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">总计</p>
                    <p className="text-xl font-bold serif text-[#2D2D2D]">RM {payableTotal.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isOrdering || !isFormValid}
                    className={`min-h-[3.75rem] flex-[1.4] rounded-full px-4 py-4 text-sm font-bold tracking-widest shadow-2xl transition-all flex items-center justify-center text-center ${
                      isOrdering || !isFormValid
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        : 'bg-[#2D2D2D] text-white active:scale-95 shadow-black/30'
                    }`}
                  >
                    {isOrdering ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>
                        {!isFormValid
                          ? '填写信息继续'
                          : walletInsufficient
                            ? '余额不足，去充值'
                            : paymentMethod === 'wallet'
                              ? '使用钱包支付'
                              : paymentMethod === 'stripe'
                                ? `支付 RM ${payableTotal.toFixed(2)}`
                                : '确认下单'}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {receiptPreview && isReceiptPreviewOpen && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/80 p-6" onClick={() => setIsReceiptPreviewOpen(false)}>
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white"
            onClick={() => setIsReceiptPreviewOpen(false)}
            aria-label="关闭截图预览"
          >
            <X size={22} />
          </button>
          <img
            src={receiptPreview}
            alt="TNG付款截图大图"
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
      <span className={`font-bold ${highlight ? 'text-emerald-600' : 'text-[#2D2D2D]'}`}>{displayValue}</span>
    </div>
  );
}

function PaymentTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold transition-all ${
        active
          ? 'bg-[#2D2D2D] text-white shadow-lg shadow-black/15'
          : 'bg-white/70 text-stone-500 shadow-sm'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ItemCustomization({ item }: { item: CartLine }) {
  const optionText = item.selectedOptions.length
    ? item.selectedOptions.map(option => `${option.groupName}: ${option.name}`).join(' · ')
    : '';

  if (!optionText && !item.note) return null;

  return (
    <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-stone-400">
      {optionText && <p className="line-clamp-2">{optionText}</p>}
      {item.note && <p className="line-clamp-2">备注：{item.note}</p>}
    </div>
  );
}

export default Cart;
