import React, { useEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthMeResponse } from '../types/auth';

const COUNTRY_DIAL_CODES = [
  { code: '+60', label: 'MY', name: 'Malaysia' },
  { code: '+65', label: 'SG', name: 'Singapore' },
  { code: '+66', label: 'TH', name: 'Thailand' },
  { code: '+84', label: 'VN', name: 'Vietnam' },
  { code: '+86', label: 'CN', name: 'China' },
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (session: AuthMeResponse) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthenticated }) => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+60');
  const [code, setCode] = useState('');
  const [reqid, setReqid] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setAgreedToTerms(false);
  }, [isOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const getComposedPhone = () => {
    const digits = phone.replace(/\D/g, '');
    const nationalNumber = digits.startsWith('0') ? digits.slice(1) : digits;
    return `${dialCode}${nationalNumber}`;
  };

  const requestOtp = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getComposedPhone() }),
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
        body: JSON.stringify({ phone: getComposedPhone(), reqid, code }),
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

  const isSubmitDisabled = isLoading || !agreedToTerms || !phone.trim() || (step === 'otp' && code.length < 4);

  return (
    <div className="fixed inset-0 z-[120] max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-md" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 flex h-[76vh] max-h-[76vh] min-h-[34rem] flex-col overflow-hidden rounded-t-[2rem] bg-[#FAFAFB] shadow-[0_-28px_70px_rgba(0,0,0,0.22)] animate-slide-up">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#D2D2D7] flex-none" />

        <div className="relative flex flex-none items-center justify-between px-6 pt-5">
          {step === 'otp' ? (
            <button
              onClick={resetPhoneStep}
              aria-label={t('common.back')}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-[#6E6E73] shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:text-[#1D1D1F]"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
          <img
            src="/logo/logo.png"
            alt={`${t('common.brand')} Logo`}
            className="absolute left-1/2 top-5 h-10 w-28 -translate-x-1/2 object-contain"
          />
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-[#6E6E73] shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:text-[#1D1D1F]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-none flex-col items-center px-8 pt-12 text-center">
          <h2 className="text-[32px] font-semibold leading-tight tracking-normal text-[#1D1D1F]">{t('auth.loginTitle')}</h2>
          <div className="mt-3 h-1 w-10 rounded-full bg-[#B08A5B]" />
          <p className="mt-4 max-w-[18.5rem] text-[15px] leading-6 text-[#6E6E73]">
            {step === 'phone'
              ? t('auth.loginSubtitle')
              : t('auth.otpHint', { phone: displayPhone })}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-start px-6 pb-7 pt-8">
          <div className="w-full space-y-4">
            <div className="space-y-3">
              <div className="flex overflow-hidden rounded-[1.35rem] border border-black/10 bg-white shadow-sm transition focus-within:border-black/20">
                <label className="relative flex flex-none items-center border-r border-black/10 bg-[#FBFBFD]">
                  <span className="sr-only">{t('auth.countryCode')}</span>
                  <select
                    value={dialCode}
                    onChange={(event) => setDialCode(event.target.value)}
                    disabled={step === 'otp'}
                    className="h-full w-[6.5rem] appearance-none bg-transparent py-4 pl-4 pr-8 text-sm font-medium text-[#1D1D1F] outline-none disabled:text-[#86868B]"
                  >
                    {COUNTRY_DIAL_CODES.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.label} {country.code}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#86868B]">▾</span>
                </label>
                <div className="relative min-w-0 flex-1">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={step === 'otp'}
                    type="tel"
                    placeholder={t('auth.phonePlaceholder')}
                    className="w-full bg-transparent px-4 py-4 text-left text-[16px] font-normal text-[#1D1D1F] outline-none placeholder:text-[#A1A1A6] disabled:text-[#86868B]"
                  />
                </div>
              </div>
              <p className="text-center text-xs leading-5 text-[#86868B]">{t('auth.secureHint')}</p>
            </div>

            {step === 'otp' && (
              <div className="space-y-3.5 animate-fade-in">
                <label className="block">
                  <div className="relative">
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      placeholder={t('auth.otpPlaceholder')}
                      className={`w-full rounded-[1.35rem] border border-black/10 bg-white px-5 py-4 text-center font-normal text-[#1D1D1F] shadow-sm outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-[#A1A1A6] focus:border-black/20 ${code ? 'text-[20px] font-semibold tracking-[0.18em]' : 'text-[15px] tracking-normal'}`}
                    />
                  </div>
                </label>
                <div className="flex items-center justify-center gap-5 text-xs">
                  <button
                    onClick={resetPhoneStep}
                    disabled={isLoading}
                    className="font-medium text-[#6E6E73] transition hover:text-[#1D1D1F] active:scale-[0.98] disabled:opacity-50"
                  >
                    {t('auth.changePhone')}
                  </button>
                  <span className="h-3 w-px bg-black/10" />
                  <button
                    onClick={requestOtp}
                    disabled={isLoading || cooldown > 0}
                    className="font-medium text-[#6E6E73] transition hover:text-[#1D1D1F] active:scale-[0.98] disabled:opacity-50"
                  >
                    {cooldown > 0 ? t('auth.resendAfter', { seconds: cooldown }) : t('auth.resend')}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-[1.25rem] border border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={step === 'phone' ? requestOtp : verifyOtp}
              disabled={isSubmitDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1D1D1F] py-4 text-[15px] font-semibold text-white shadow-lg shadow-black/15 transition active:scale-[0.98] disabled:bg-[#D2D2D7] disabled:text-[#86868B] disabled:shadow-none"
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

            <label htmlFor="auth-terms" className="mx-auto mt-10 flex max-w-[21rem] items-start justify-center gap-2 px-2 py-1 text-center text-xs leading-5 text-[#6E6E73]">
              <input
                id="auth-terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(event) => setAgreedToTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none rounded border-[#D2D2D7] accent-[#1D1D1F]"
              />
              <span>
                {t('auth.agreePrefix')}
                <a
                  href="#terms"
                  onClick={(event) => event.stopPropagation()}
                  className="font-semibold text-[#1D1D1F] underline decoration-[#A1A1A6]/40 underline-offset-4"
                >
                  {t('auth.terms')}
                </a>
                {t('auth.agreeConnector')}
                <a
                  href="#privacy"
                  onClick={(event) => event.stopPropagation()}
                  className="font-semibold text-[#1D1D1F] underline decoration-[#A1A1A6]/40 underline-offset-4"
                >
                  {t('auth.privacy')}
                </a>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
