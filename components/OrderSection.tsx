
import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface OrderSectionProps {
  onOrderClick?: () => void;
}

const OrderSection: React.FC<OrderSectionProps> = ({ onOrderClick }) => {
  return (
    <div className="relative w-full group overflow-hidden bg-gradient-to-br from-[#1F1F1F] via-[#2A2A2A] to-[#1A1A1A] rounded-[1.5rem] py-8 px-6 text-white shadow-xl border border-white/5">
      {/* Background Icon Integration - Large and subtle */}
      <div className="absolute -right-4 -bottom-6 opacity-[0.07] transform rotate-12 transition-transform duration-700">
        <ShoppingBag size={140} strokeWidth={1} />
      </div>
      
      {/* Secondary accent blur */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-[#C8A97E]/10 rounded-full blur-[60px]"></div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <h3 className="text-xl font-bold serif mb-2 tracking-wide">堂食 & 外卖</h3>
        <p className="text-stone-400 text-xs mb-6 font-light tracking-widest opacity-80 uppercase">Dine-in & Delivery Available</p>
        
        <button 
          onClick={onOrderClick}
          className="flex items-center space-x-2 px-6 py-2.5 bg-[#C8A97E] text-white rounded-full font-semibold text-sm hover:bg-[#B39669] transition-all duration-300 shadow-lg shadow-[#C8A97E]/20 active:scale-[0.97]"
        >
          <span>进入点单系统</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default OrderSection;
