import React, { useEffect, useState } from 'react';
import { X, Phone, ShieldCheck, ArrowRight, ArrowLeft, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthMeResponse } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (session: AuthMeResponse) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthenticated }) => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [reqid, setReqid] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
  }, [isOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const requestOtp = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || t('auth.sendFailed'));
      setReqid(payload.reqid);
      setDisplayPhone(payload.displayPhone);
      setStep('otp');
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.sendFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetPhoneStep = () => {
    setStep('phone');
    setCode('');
    setReqid('');
    setDisplayPhone('');
    setError('');
  };

  const verifyOtp = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, reqid, code }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || t('auth.loginFailed'));
      onAuthenticated(payload);
      setCode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginRetry'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[94vh] overflow-hidden rounded-t-[2.5rem] bg-[#F5F5F5] shadow-2xl animate-slide-up">
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 flex-none" />

        <div className="px-8 pt-6 pb-4 flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            {step === 'otp' && (
              <button onClick={resetPhoneStep} className="p-2 -ml-2 text-stone-400 hover:text-[#2D2D2D] transition-colors">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold serif text-[#2D2D2D]">{t('auth.title')}</h2>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-0.5">
                {step === 'phone' ? t('auth.phoneStep') : t('auth.otpStep')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-stone-100 text-stone-500 rounded-full hover:bg-stone-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(94vh-6.5rem)] overflow-y-auto px-8 pb-10 no-scrollbar">
          <div className="mb-6 rounded-3xl bg-white p-5 border border-stone-100 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#FBF7EF] text-[#C8A97E]">
                {step === 'phone' ? <Phone size={22} /> : <MessageCircle size={22} />}
              </div>
              <div>
                <p className="text-sm font-bold text-[#2D2D2D]">
                  {step === 'phone' ? t('auth.phoneTitle') : t('auth.otpTitle')}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-400">
                  {step === 'phone'
                    ? t('auth.phoneHint')
                    : t('auth.otpHint', { phone: displayPhone })}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl bg-white p-5 border border-stone-100 shadow-sm">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={17} />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={step === 'otp'}
                type="tel"
                placeholder={t('auth.phonePlaceholder')}
                className="w-full rounded-2xl border border-stone-100 bg-stone-50 py-4 pl-11 pr-4 text-sm outline-none transition focus:border-[#C8A97E] disabled:text-stone-400"
              />
            </div>

            {step === 'otp' && (
              <div className="space-y-3 animate-fade-in">
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={17} />
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder={t('auth.otpPlaceholder')}
                    className="w-full rounded-2xl border border-stone-100 bg-stone-50 py-4 pl-11 pr-4 text-center text-lg font-bold tracking-[0.3em] outline-none transition focus:border-[#C8A97E]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={resetPhoneStep}
                    disabled={isLoading}
                    className="rounded-2xl bg-stone-100 py-3 text-xs font-bold text-stone-500 disabled:opacity-60"
                  >
                    {t('auth.changePhone')}
                  </button>
                  <button
                    onClick={requestOtp}
                    disabled={isLoading || cooldown > 0}
                    className="rounded-2xl bg-stone-100 py-3 text-xs font-bold text-stone-500 disabled:opacity-60"
                  >
                    {cooldown > 0 ? t('auth.resendAfter', { seconds: cooldown }) : t('auth.resend')}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={step === 'phone' ? requestOtp : verifyOtp}
              disabled={isLoading || !phone.trim() || (step === 'otp' && code.length < 4)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2D2D] py-4 text-sm font-bold tracking-widest text-white shadow-xl shadow-black/20 transition active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
            >
              {isLoading ? (
                <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <span>{step === 'phone' ? t('auth.sendOtp') : t('auth.confirmLogin')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
