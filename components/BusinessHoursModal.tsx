import { Clock3, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface BusinessHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  temporarilyPaused?: boolean;
  hours?: string;
}

export function BusinessHoursModal({ isOpen, onClose, temporarilyPaused = false, hours }: BusinessHoursModalProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm" role="presentation">
      <section
        aria-describedby="business-hours-description"
        aria-labelledby="business-hours-title"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-[2rem] bg-white p-7 text-center shadow-2xl"
        role="dialog"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition active:scale-95"
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#C8A97E]/15 text-[#B08D5D]">
          <Clock3 size={30} />
        </div>
        <h2 id="business-hours-title" className="serif mt-5 text-2xl font-bold text-[#2D2D2D]">
          {t(temporarilyPaused ? 'businessHours.pausedTitle' : 'businessHours.closedTitle')}
        </h2>
        <p id="business-hours-description" className="mt-3 text-sm leading-6 text-stone-500">
          {t(temporarilyPaused ? 'businessHours.pausedDescription' : 'businessHours.closedDescription')}
        </p>

        <div className="mt-6 rounded-2xl bg-stone-50 p-4 text-left">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#2D2D2D]">
            <Clock3 size={17} className="flex-none text-[#C8A97E]" />
            <span>{hours || t('businessHours.hours')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-[#2D2D2D] py-3.5 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          {t('businessHours.acknowledge')}
        </button>
      </section>
    </div>
  );
}
