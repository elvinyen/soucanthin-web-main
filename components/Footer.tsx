
import React from 'react';
import { Facebook, MessageCircle } from 'lucide-react';

const SOCIAL_LINKS = {
  facebook: import.meta.env.VITE_FACEBOOK_URL || '',
  whatsapp: import.meta.env.VITE_WHATSAPP_URL || '',
};

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1A1A1A] text-white pt-16 pb-5 px-8">
      <div className="flex flex-col items-center text-center space-y-6">
        {/* Column 1: Logo */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-4">
            <img src="/logo/sct_logo.png" alt="深夜食汤 Logo" className="w-2/3 h-2/3 object-contain" />
          </div>
          <h2 className="text-xl font-bold serif tracking-widest">深夜食汤</h2>
          <p className="text-[10px] text-stone-500 tracking-[0.3em] uppercase mt-1">Soup Can Thin</p>
        </div>

        {/* Grid for columns 2, 3, 4 */}
        <div className="grid grid-cols-1 gap-10 w-full">
          {/* Column 2: Business */}
          <div className="space-y-3">
            <h4 className="text-[#C8A97E] text-xs font-bold tracking-widest uppercase">主营业务</h4>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-stone-400 text-sm">
              <span>小碗炖汤</span>
              <span className="text-stone-700">|</span>
              <span>泰式热菜</span>
              <span className="text-stone-700">|</span>
              <span>越南美食</span>
            </div>
          </div>

          {/* Column 3: Hours & Location */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-[#C8A97E] text-xs font-bold tracking-widest uppercase">营业时间</h4>
              <p className="text-stone-400 text-sm">00:00-09:40 & 16:00-23:59</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[#C8A97E] text-xs font-bold tracking-widest uppercase">地点</h4>
              <p className="text-stone-400 text-sm">Kuala Lumpur, Malaysia</p>
            </div>
          </div>

          {/* Column 4: Socials */}
          <div className="space-y-4">
             <h4 className="text-[#C8A97E] text-xs font-bold tracking-widest uppercase">社交媒体</h4>
             <div className="flex justify-center space-x-6">
                {SOCIAL_LINKS.facebook && (
                <a
                  href={SOCIAL_LINKS.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="打开深夜食汤 Facebook"
                  className="p-3 bg-stone-800 rounded-full hover:bg-[#C8A97E] transition-colors"
                >
                  <Facebook size={20} />
                </a>
                )}
                {SOCIAL_LINKS.whatsapp && (
                <a
                  href={SOCIAL_LINKS.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="打开深夜食汤 WhatsApp"
                  className="p-3 bg-stone-800 rounded-full hover:bg-[#C8A97E] transition-colors"
                >
                  <MessageCircle size={20} />
                </a>
                )}
             </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-5 border-t border-stone-800 w-full">
          <p className="text-[11px] text-stone-600 tracking-widest uppercase">
            © 2026 深夜食汤 · All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
