import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';
import type { LanguageCode } from '../types/i18n';

const languageLabels: Record<LanguageCode, string> = {
  zh: '中文',
  en: 'English',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

interface LanguageSelectorProps {
  align?: 'left' | 'right';
  className?: string;
}

const SimpleGlobeIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3 10h14M10 2.75c1.8 1.95 2.7 4.37 2.7 7.25s-.9 5.3-2.7 7.25C8.2 15.3 7.3 12.88 7.3 10S8.2 4.7 10 2.75Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ align = 'right', className = '' }) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] as LanguageCode;

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isOpen]);

  const changeLanguage = (language: LanguageCode) => {
    i18n.changeLanguage(language);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-label={t('language.label')}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#2D2D2D] shadow-sm ring-1 ring-stone-100 transition active:scale-95"
      >
        <SimpleGlobeIcon />
      </button>

      {isOpen && (
        <div
          className={`absolute top-12 z-[140] w-44 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          {SUPPORTED_LANGUAGES.map(language => {
            const active = currentLanguage === language;
            return (
              <button
                key={language}
                type="button"
                onClick={() => changeLanguage(language)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                  active ? 'bg-[#2D2D2D] text-white' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span>{languageLabels[language]}</span>
                {active && <Check size={15} className="text-[#C8A97E]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
