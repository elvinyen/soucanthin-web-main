import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import type { LanguageCode } from '../types/i18n';
import en from './locales/en.json';
import th from './locales/th.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['zh', 'en', 'th', 'vi'];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'soucanthin.language';

export function normalizeLanguage(value?: string | null): LanguageCode | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(normalized as LanguageCode) ? normalized as LanguageCode : undefined;
}

const urlLanguage = normalizeLanguage(new URLSearchParams(window.location.search).get('lang'));
if (urlLanguage) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, urlLanguage);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
      th: { translation: th },
      vi: { translation: vi },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    lng: urlLanguage,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => normalizeLanguage(lng) || DEFAULT_LANGUAGE,
    },
  });

export default i18n;
