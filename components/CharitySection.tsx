
import React from 'react';
import { useTranslation } from 'react-i18next';

const charityImages = [
  '/charity/3.jpg',
  '/charity/1.jpg',
  '/charity/2.jpg',
];

const CharitySection: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col items-center space-y-5 text-center px-2">
        <p className="text-stone-500 leading-relaxed text-sm font-medium italic">
          “{t('homePage.charityText')}”
        </p>
        <button className="px-6 py-2 border border-[#C8A97E] text-[#C8A97E] rounded-full text-[12px] font-bold tracking-[0.2em] uppercase hover:bg-[#C8A97E] hover:text-white transition-all">
          {t('homePage.learnMore')}
        </button>
      </div>

      <div className="flex space-x-4 overflow-x-auto no-scrollbar snap-x -mx-8 px-8">
        {charityImages.map((img, i) => (
          <div key={i} className="flex-none w-64 h-40 rounded-2xl overflow-hidden snap-center shadow-md">
            <img 
              src={img} 
              className="w-full h-full object-cover  hover:grayscale-0 transition-all duration-700 ease-in-out transform hover:scale-105" 
              alt="Charity Activity" 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharitySection;
