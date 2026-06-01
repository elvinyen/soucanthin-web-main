import type { MenuItem, MenuOptionGroup } from './menu';
import type { LanguageCode } from '../types/i18n';

export type MenuTranslation = {
  name?: string;
  description?: string;
  detail?: string;
  category?: string;
  tags?: string[];
  optionGroups?: {
    id: string;
    name?: string;
    options?: {
      id: string;
      name?: string;
    }[];
  }[];
};

export type MenuTranslations = Partial<Record<LanguageCode, MenuTranslation>>;

export const MENU_TRANSLATIONS: Record<number, MenuTranslations> = {
  1: {
    en: {
      name: 'Herbal Pork Stew',
      description: 'A gentle herbal slow-cooked soup for late-night warmth and nourishment.',
      detail: 'Slow-cooked with codonopsis, angelica, astragalus, and other warming herbs. The broth is clear and light, ideal when you want something soothing at night. Add rice or pork slices to taste.',
      category: 'Soups',
      tags: ['Signature', 'Slow-cooked'],
      optionGroups: [{ id: 'portion', name: 'Add-ons', options: [{ id: 'rice', name: 'Add rice' }, { id: 'pork', name: 'Add pork slices' }] }],
    },
    th: {
      name: 'ซุปหมูสมุนไพร',
      description: 'ซุปสมุนไพรเคี่ยวช้า อุ่นท้อง เหมาะสำหรับมื้อดึก',
      detail: 'เคี่ยวช้าด้วยตังเซียม ตังกุย หวงฉี และสมุนไพรบำรุงอื่นๆ น้ำซุปใส ไม่เลี่ยน เหมาะสำหรับมื้อดึกที่ต้องการความอุ่นสบาย สามารถเพิ่มข้าวหรือหมูสไลซ์ได้',
      category: 'ซุป',
      tags: ['ซิกเนเจอร์', 'เคี่ยวช้า'],
      optionGroups: [{ id: 'portion', name: 'ตัวเลือกเพิ่ม', options: [{ id: 'rice', name: 'เพิ่มข้าว' }, { id: 'pork', name: 'เพิ่มหมูสไลซ์' }] }],
    },
    vi: {
      name: 'Súp heo thảo mộc',
      description: 'Súp thảo mộc hầm chậm, ấm bụng và nhẹ nhàng cho bữa khuya.',
      detail: 'Hầm chậm với đảng sâm, đương quy, hoàng kỳ và các vị thuốc bổ ấm. Nước súp trong, nhẹ, phù hợp khi muốn ăn khuya thanh dịu. Có thể thêm cơm hoặc thịt heo lát.',
      category: 'Súp',
      tags: ['Đặc trưng', 'Hầm chậm'],
      optionGroups: [{ id: 'portion', name: 'Tùy chọn thêm', options: [{ id: 'rice', name: 'Thêm cơm' }, { id: 'pork', name: 'Thêm thịt heo lát' }] }],
    },
  },
  3: {
    en: {
      name: 'Seafood Tom Yum',
      description: 'Bright spicy-sour Thai broth with seafood.',
      detail: 'Thai aromatics, lemongrass, galangal, and lime create a vivid spicy-sour broth with prawns, squid, and shellfish. Spice level and extra seafood can be adjusted.',
      category: 'Thai Food',
      tags: ['Spicy-sour', 'Seafood'],
      optionGroups: [
        { id: 'spice', name: 'Spice level', options: [{ id: 'mild', name: 'Mild' }, { id: 'regular', name: 'Regular spicy' }, { id: 'extra', name: 'Extra spicy' }] },
        { id: 'add-on', name: 'Add-ons', options: [{ id: 'shrimp', name: 'Add prawns' }, { id: 'mushroom', name: 'Add mushrooms' }] },
      ],
    },
    th: {
      name: 'ต้มยำทะเล',
      description: 'ซุปต้มยำรสเปรี้ยวเผ็ดพร้อมซีฟู้ด',
      detail: 'สมุนไพรไทย ตะไคร้ ข่า และมะนาวให้รสเปรี้ยวเผ็ดชัดเจน เสิร์ฟพร้อมกุ้ง ปลาหมึก และหอย ปรับระดับความเผ็ดและเพิ่มซีฟู้ดได้',
      category: 'อาหารไทย',
      tags: ['เปรี้ยวเผ็ด', 'ซีฟู้ด'],
      optionGroups: [
        { id: 'spice', name: 'ระดับความเผ็ด', options: [{ id: 'mild', name: 'เผ็ดน้อย' }, { id: 'regular', name: 'เผ็ดปกติ' }, { id: 'extra', name: 'เพิ่มเผ็ด' }] },
        { id: 'add-on', name: 'เพิ่มพิเศษ', options: [{ id: 'shrimp', name: 'เพิ่มกุ้ง' }, { id: 'mushroom', name: 'เพิ่มเห็ด' }] },
      ],
    },
    vi: {
      name: 'Tom Yum hải sản',
      description: 'Nước súp Thái chua cay rõ vị cùng hải sản.',
      detail: 'Hương liệu Thái, sả, riềng và chanh tạo nước súp chua cay nổi bật, ăn cùng tôm, mực và nghêu sò. Có thể chỉnh độ cay và thêm hải sản.',
      category: 'Món Thái',
      tags: ['Chua cay', 'Hải sản'],
      optionGroups: [
        { id: 'spice', name: 'Độ cay', options: [{ id: 'mild', name: 'Ít cay' }, { id: 'regular', name: 'Cay vừa' }, { id: 'extra', name: 'Thêm cay' }] },
        { id: 'add-on', name: 'Topping thêm', options: [{ id: 'shrimp', name: 'Thêm tôm' }, { id: 'mushroom', name: 'Thêm nấm' }] },
      ],
    },
  },
  4: {
    en: {
      name: 'Pad Krapow Moo',
      description: 'Fragrant Thai basil stir-fry, perfect with rice.',
      detail: 'Minced pork, basil leaves, garlic, and Thai sauce are quickly stir-fried over high heat. Lightly spicy by default and ideal as a rice dish.',
      category: 'Thai Food',
      tags: ['Stir-fry', 'Mild spicy'],
      optionGroups: [{ id: 'add-on', name: 'Add-ons', options: [{ id: 'egg', name: 'Add fried egg' }, { id: 'rice', name: 'Add rice' }] }],
    },
    th: {
      name: 'ผัดกะเพราหมู',
      description: 'ผัดกะเพราหอมเข้ม เหมาะทานคู่ข้าว',
      detail: 'หมูสับ ใบกะเพรา กระเทียม และซอสไทย ผัดไฟแรงจนหอม ค่าเริ่มต้นเผ็ดน้อย เหมาะเป็นจานหลักคู่ข้าว',
      category: 'อาหารไทย',
      tags: ['ผัดร้อน', 'เผ็ดน้อย'],
      optionGroups: [{ id: 'add-on', name: 'เพิ่มพิเศษ', options: [{ id: 'egg', name: 'เพิ่มไข่ดาว' }, { id: 'rice', name: 'เพิ่มข้าว' }] }],
    },
    vi: {
      name: 'Thịt heo xào húng quế Thái',
      description: 'Món xào thơm mùi húng quế Thái, hợp ăn với cơm.',
      detail: 'Thịt heo băm, lá húng quế, tỏi và sốt Thái được xào nhanh lửa lớn. Mặc định hơi cay, phù hợp làm món chính ăn với cơm.',
      category: 'Món Thái',
      tags: ['Món xào', 'Hơi cay'],
      optionGroups: [{ id: 'add-on', name: 'Topping thêm', options: [{ id: 'egg', name: 'Thêm trứng chiên' }, { id: 'rice', name: 'Thêm cơm' }] }],
    },
  },
  5: {
    en: {
      name: 'Beef Pho',
      description: 'Clear beef bone broth with rice noodles and sliced beef.',
      detail: 'Long-simmered beef bone broth with rice noodles, sliced beef, herbs, and lime. Light and refreshing when you want a filling but not heavy meal.',
      category: 'Vietnamese Food',
      tags: ['Noodle soup', 'Refreshing'],
      optionGroups: [{ id: 'add-on', name: 'Add-ons', options: [{ id: 'beef', name: 'Add sliced beef' }, { id: 'noodle', name: 'Add noodles' }] }],
    },
    th: {
      name: 'เฝอเนื้อ',
      description: 'น้ำซุปกระดูกเนื้อหอมใส พร้อมเส้นเฝอและเนื้อสไลซ์',
      detail: 'น้ำซุปกระดูกเนื้อเคี่ยวนาน เสิร์ฟกับเส้นเฝอ เนื้อสไลซ์ สมุนไพร และมะนาว รสเบาสดชื่น เหมาะเมื่ออยากทานอาหารหลักที่ไม่หนักเกินไป',
      category: 'อาหารเวียดนาม',
      tags: ['ก๋วยเตี๋ยวน้ำ', 'สดชื่น'],
      optionGroups: [{ id: 'add-on', name: 'เพิ่มพิเศษ', options: [{ id: 'beef', name: 'เพิ่มเนื้อสไลซ์' }, { id: 'noodle', name: 'เพิ่มเส้นเฝอ' }] }],
    },
    vi: {
      name: 'Phở bò',
      description: 'Nước dùng xương bò thanh thơm cùng phở và bò lát.',
      detail: 'Nước dùng xương bò hầm lâu, ăn cùng phở, bò lát, rau thơm và chanh. Vị thanh nhẹ, phù hợp khi muốn ăn no nhưng không quá đậm.',
      category: 'Món Việt',
      tags: ['Phở nước', 'Thanh nhẹ'],
      optionGroups: [{ id: 'add-on', name: 'Topping thêm', options: [{ id: 'beef', name: 'Thêm bò lát' }, { id: 'noodle', name: 'Thêm phở' }] }],
    },
  },
  6: {
    en: {
      name: 'Fresh Spring Rolls',
      description: 'Fresh vegetables wrapped in rice paper, great for sharing.',
      detail: 'Rice paper wraps fresh vegetables, herbs, and refreshing fillings, served with dipping sauce. Ideal for sharing or as a light starter.',
      category: 'Vietnamese Food',
      tags: ['Snack', 'Refreshing'],
      optionGroups: [{ id: 'sauce', name: 'Dipping sauce', options: [{ id: 'peanut', name: 'Peanut sauce' }, { id: 'fish', name: 'Sweet-sour fish sauce' }] }],
    },
    th: {
      name: 'ปอเปี๊ยะสดเวียดนาม',
      description: 'ผักสดและแผ่นแป้งข้าว เหมาะเป็นของว่างแบ่งกันทาน',
      detail: 'แผ่นแป้งข้าวห่อผักสด สมุนไพร และไส้รสสดชื่น เสิร์ฟกับน้ำจิ้ม เหมาะสำหรับแบ่งกันหรือเป็นจานเรียกน้ำย่อยเบาๆ',
      category: 'อาหารเวียดนาม',
      tags: ['ของว่าง', 'สดชื่น'],
      optionGroups: [{ id: 'sauce', name: 'น้ำจิ้ม', options: [{ id: 'peanut', name: 'ซอสถั่ว' }, { id: 'fish', name: 'น้ำปลาหวานเปรี้ยว' }] }],
    },
    vi: {
      name: 'Gỏi cuốn',
      description: 'Rau tươi cuốn bánh tráng, món nhẹ phù hợp để chia sẻ.',
      detail: 'Bánh tráng cuốn rau tươi, rau thơm và nhân thanh mát, dùng cùng nước chấm. Phù hợp để chia sẻ hoặc làm món khai vị nhẹ.',
      category: 'Món Việt',
      tags: ['Món nhẹ', 'Thanh mát'],
      optionGroups: [{ id: 'sauce', name: 'Nước chấm', options: [{ id: 'peanut', name: 'Sốt đậu phộng' }, { id: 'fish', name: 'Nước mắm chua ngọt' }] }],
    },
  },
  7: {
    en: {
      name: 'Soursop Drink',
      description: 'Sweet tropical soursop flavor made into a refreshing fruit drink.',
      detail: 'Made with soursop fruit flavor for a naturally tropical aroma and gentle sweetness. Best served chilled, refreshing with hot dishes or after a meal.',
      category: 'Drinks',
      tags: ['Fruity', 'Refreshing'],
      optionGroups: [],
    },
    th: {
      name: 'น้ำทุเรียนเทศ',
      description: 'เครื่องดื่มผลไม้รสทุเรียนเทศ หอมหวานสดชื่น',
      detail: 'ปรุงด้วยรสผลทุเรียนเทศ ให้กลิ่นผลไม้เมืองร้อนและความหวานนุ่ม ดื่มเย็นแล้วสดชื่น เหมาะกับอาหารจานร้อนหรือหลังมื้ออาหาร',
      category: 'เครื่องดื่ม',
      tags: ['กลิ่นผลไม้', 'สดชื่น'],
      optionGroups: [],
    },
    vi: {
      name: 'Nước mãng cầu xiêm',
      description: 'Hương mãng cầu xiêm nhiệt đới, thanh mát và ngọt dịu.',
      detail: 'Pha với hương vị mãng cầu xiêm, có mùi trái cây nhiệt đới tự nhiên và vị ngọt nhẹ. Uống lạnh rất thanh mát, hợp dùng với món nóng hoặc sau bữa ăn.',
      category: 'Đồ uống',
      tags: ['Vị trái cây', 'Thanh mát'],
      optionGroups: [],
    },
  },
  8: {
    en: {
      name: 'Salted Lime 7-Up',
      description: 'Salted lime with soda, refreshing and cuts through richness.',
      detail: 'Salted lime mixed with 7-Up for a salty, sour, and sweet drink. Great with bold stir-fries or spicy-sour soups.',
      category: 'Drinks',
      tags: ['Iced drink', 'Refreshing'],
      optionGroups: [{ id: 'ice', name: 'Ice level', options: [{ id: 'less', name: 'Less ice' }, { id: 'regular', name: 'Regular ice' }] }],
    },
    th: {
      name: 'มะนาวดองเซเว่นอัพ',
      description: 'มะนาวดองผสมโซดา สดชื่น ตัดเลี่ยน',
      detail: 'มะนาวดองผสมเซเว่นอัพ ให้รสเค็ม เปรี้ยว หวาน เหมาะกับอาหารผัดรสจัดหรือซุปเปรี้ยวเผ็ด',
      category: 'เครื่องดื่ม',
      tags: ['เครื่องดื่มเย็น', 'สดชื่น'],
      optionGroups: [{ id: 'ice', name: 'ระดับน้ำแข็ง', options: [{ id: 'less', name: 'น้ำแข็งน้อย' }, { id: 'regular', name: 'น้ำแข็งปกติ' }] }],
    },
    vi: {
      name: '7-Up chanh muối',
      description: 'Chanh muối pha soda, thanh mát và đỡ ngấy.',
      detail: 'Chanh muối pha cùng 7-Up, vị mặn thơm chua ngọt. Hợp dùng với món xào đậm vị hoặc súp chua cay.',
      category: 'Đồ uống',
      tags: ['Đồ uống đá', 'Thanh mát'],
      optionGroups: [{ id: 'ice', name: 'Lượng đá', options: [{ id: 'less', name: 'Ít đá' }, { id: 'regular', name: 'Đá thường' }] }],
    },
  },
};

export function localizeMenuItems(items: MenuItem[], language: LanguageCode): MenuItem[] {
  return items.map(item => localizeMenuItem(item, language));
}

export function localizeMenuItem(item: MenuItem, language: LanguageCode): MenuItem {
  const translation = MENU_TRANSLATIONS[item.id]?.[language] || MENU_TRANSLATIONS[item.id]?.zh;
  if (!translation) return item;
  return {
    ...item,
    name: translation.name || item.name,
    description: translation.description || item.description,
    detail: translation.detail || item.detail,
    category: translation.category || item.category,
    tags: translation.tags || item.tags,
    optionGroups: mergeOptionGroups(item.optionGroups, translation.optionGroups),
  };
}

function mergeOptionGroups(groups: MenuOptionGroup[] | undefined, translations: MenuTranslation['optionGroups']) {
  if (!groups?.length || !translations?.length) return groups;
  return groups.map(group => {
    const translatedGroup = translations.find(item => item.id === group.id);
    if (!translatedGroup) return group;
    return {
      ...group,
      name: translatedGroup.name || group.name,
      options: group.options.map(option => ({
        ...option,
        name: translatedGroup.options?.find(item => item.id === option.id)?.name || option.name,
      })),
    };
  });
}
