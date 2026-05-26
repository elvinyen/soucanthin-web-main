
import React from 'react';
import { useTranslation, Trans } from 'react-i18next';

const LuckyDraw: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-stone-200/50 border border-stone-100 animate-fade-in-up">
      <div className="relative h-54 bg-[#FBF9F4] flex items-center justify-center">
        <img 
          src="/activity/iphone17pro_1.png" 
          alt="iPhone 17 Pro" 
          className="h-full w-full object-cover drop-shadow-2xl"
        />
        <div className="absolute top-4 right-4 bg-[#C8A97E] text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">
          {t('luckyDraw.badge')}
        </div>
      </div>
      
      <div className="p-6 text-center">
        <h3 className="text-xl font-bold text-[#2D2D2D] serif mb-2">{t('luckyDraw.title')}</h3>
        <p className="text-stone-500 text-sm mb-6">
          <Trans i18nKey="luckyDraw.description" components={{ highlight: <span className="text-[#C8A97E] font-semibold" /> }} />
        </p>
        
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between text-sm px-4 py-2 bg-stone-50 rounded-xl">
            <span className="text-stone-400">{t('luckyDraw.special')}</span>
            <span className="font-medium text-[#2D2D2D]">{t('luckyDraw.iphone')}</span>
          </div>
          <div className="flex items-center justify-between text-sm px-4 py-2 bg-stone-50 rounded-xl">
            <span className="text-stone-400">{t('luckyDraw.first')}</span>
            <span className="font-medium text-[#2D2D2D]">{t('luckyDraw.voucher2000')}</span>
          </div>
          <div className="flex items-center justify-between text-sm px-4 py-2 bg-stone-50 rounded-xl">
            <span className="text-stone-400">{t('luckyDraw.second')}</span>
            <span className="font-medium text-[#2D2D2D]">{t('luckyDraw.voucher1000')}</span>
          </div>
        </div>

        <button className="w-full py-4 bg-[#C8A97E] text-white rounded-2xl font-semibold text-base shadow-lg shadow-[#C8A97E]/30 active:scale-[0.98] transition-transform">
          {t('luckyDraw.cta')}
        </button>
      </div>
    </div>
  );
};

export default LuckyDraw;
