
import React from 'react';

const charityImages = [
  '/charity/3.jpg',
  '/charity/1.jpg',
  '/charity/2.jpg',
];

const CharitySection: React.FC = () => {
  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col items-center space-y-5 text-center px-2">
        <p className="text-stone-500 leading-relaxed text-sm font-medium italic">
          “Soup Can Thin Charity 慈善团队每个月都会选有加入慈善群里天使生日当天进行慈善捐赠，都会将大家的善款化作实际行动，购买食物及日常必需品，送到有需要的难民手中。其中，食物将由我们的厨房精心准备，确保他们不仅能吃饱，还能吃得健康。”
        </p>
        <button className="px-6 py-2 border border-[#C8A97E] text-[#C8A97E] rounded-full text-[12px] font-bold tracking-[0.2em] uppercase hover:bg-[#C8A97E] hover:text-white transition-all">
          了解更多
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
