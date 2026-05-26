import React from 'react';
import { useTranslation } from 'react-i18next';

const WHATSAPP_URL = import.meta.env.VITE_WHATSAPP_URL || '';

const FloatingWhatsApp: React.FC = () => {
  const { t } = useTranslation();
  if (!WHATSAPP_URL) return null;

  return (
    <div className="pointer-events-none fixed bottom-28 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-5 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-end">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('whatsapp.aria')}
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_14px_22px_-8px_rgba(37,211,102,0.85),0_8px_18px_rgba(37,211,102,0.24)] transition-transform hover:scale-105 active:scale-95"
        >
          <span className="absolute inset-0 rounded-full bg-[#25D366]/25 animate-whatsapp-pulse" />
          <svg
            viewBox="0 0 32 32"
            aria-hidden="true"
            className="relative h-9 w-9 drop-shadow-sm"
            fill="currentColor"
          >
            <path d="M16.04 3.2A12.74 12.74 0 0 0 5.1 22.48L3.4 28.8l6.47-1.67A12.73 12.73 0 1 0 16.04 3.2Zm0 23.3a10.56 10.56 0 0 1-5.38-1.48l-.39-.23-3.84 1 1.02-3.74-.25-.39A10.54 10.54 0 1 1 16.04 26.5Zm5.78-7.9c-.32-.16-1.87-.92-2.16-1.02-.29-.11-.5-.16-.72.16-.21.32-.82 1.02-1 1.23-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.88-1.76-2.2-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.15 3.09 1.31 3.3.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.87-.77 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.13-.29-.21-.61-.37Z" />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default FloatingWhatsApp;
