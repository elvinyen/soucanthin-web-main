
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const images = [
  '/banner/1.jpg', 
  '/banner/2.jpg',
  '/banner/3.jpg' 
];

const Banner: React.FC = () => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Minimum swipe distance (in px) to trigger change
  const minSwipeDistance = 50;

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + images.length) % images.length);
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 6000); // Slowed down to 6 seconds
    return () => clearInterval(timer);
  }, [current]); // Reset timer whenever current changes (including manual swipe)

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  return (
    <div 
      className="relative w-full h-[460px] overflow-hidden touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {images.map((img, idx) => (
        <div
          key={img}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img src={img} className="w-full h-full object-cover" alt="Banner" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        </div>
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
        <div className="space-y-2 translate-y-4">
          <h1 className="text-2xl font-medium tracking-widest serif drop-shadow-lg">{t('homePage.bannerTitle')}</h1>
          <div className="w-12 h-[1px] bg-[#C8A97E] mx-auto mt-4"></div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
        {images.map((_, idx) => (
          <div 
            key={idx}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === current ? 'w-6 bg-[#C8A97E]' : 'w-2 bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Banner;
