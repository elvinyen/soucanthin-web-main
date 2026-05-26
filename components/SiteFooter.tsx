import React from 'react';
import { Facebook, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SOCIAL_LINKS = {
  facebook: import.meta.env.VITE_FACEBOOK_URL || '',
  whatsapp: import.meta.env.VITE_WHATSAPP_URL || '',
};

const SiteFooter: React.FC = () => {
  const { t } = useTranslation();
  const services = t('footer.services', { returnObjects: true }) as string[];

  return (
    <footer className="bg-[#1A1A1A] px-8 pb-28 pt-16 text-white">
      <div className="flex flex-col items-center space-y-6 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white">
            <img src="/logo/sct_logo.png" alt={`${t('common.brandZh')} Logo`} className="h-2/3 w-2/3 object-contain" />
          </div>
          <h2 className="serif text-xl font-bold tracking-widest">{t('common.brandZh')}</h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-stone-500">Soup Can Thin</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-10">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#C8A97E]">{t('footer.business')}</h4>
            <div className="mx-auto flex max-w-xs flex-wrap justify-center gap-x-2 gap-y-2 text-sm leading-6 text-stone-400">
              {services.map((service, index) => (
                <React.Fragment key={service}>
                  <span className="whitespace-nowrap">{service}</span>
                  {index < services.length - 1 && <span className="text-stone-700">|</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#C8A97E]">{t('footer.hours')}</h4>
              <p className="text-sm text-stone-400">00:00-09:40 & 16:00-23:59</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#C8A97E]">{t('footer.location')}</h4>
              <p className="text-sm text-stone-400">Kuala Lumpur, Malaysia</p>
            </div>
          </div>

          {(SOCIAL_LINKS.facebook || SOCIAL_LINKS.whatsapp) && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#C8A97E]">{t('footer.social')}</h4>
              <div className="flex justify-center space-x-6">
                {SOCIAL_LINKS.facebook && (
                  <a
                    href={SOCIAL_LINKS.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('footer.facebookAria')}
                    className="rounded-full bg-stone-800 p-3 transition-colors hover:bg-[#C8A97E]"
                  >
                    <Facebook size={20} />
                  </a>
                )}
                {SOCIAL_LINKS.whatsapp && (
                  <a
                    href={SOCIAL_LINKS.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('footer.whatsappAria')}
                    className="rounded-full bg-stone-800 p-3 transition-colors hover:bg-[#C8A97E]"
                  >
                    <MessageCircle size={20} />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-full border-t border-stone-800 pt-5">
          <p className="text-[11px] uppercase tracking-widest text-stone-600">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
