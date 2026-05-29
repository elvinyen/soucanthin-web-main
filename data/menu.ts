export interface MenuItem {
  id: number;
  code?: string;
  name: string;
  enName: string;
  description: string;
  detail: string;
  price: number;
  category: string;
  image: string;
  tags: string[];
  optionGroups?: MenuOptionGroup[];
  recommended?: boolean;
  soldOut?: boolean;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required?: boolean;
  options: MenuOption[];
}

export interface MenuOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface CartOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

export interface CartLine {
  lineId: string;
  itemId: number;
  code?: string;
  name: string;
  image: string;
  basePrice: number;
  optionsTotal: number;
  unitPrice: number;
  quantity: number;
  selectedOptions: CartOption[];
  note?: string;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 1,
    code: 'S19',
    name: '十全大补汤',
    enName: 'Herbal Pork Stew',
    description: '温润药材慢炖汤底，适合夜宵后补气暖胃。',
    detail: '以党参、当归、黄芪等温补药材慢火熬煮，汤底清润不腻，适合想要暖胃补气的夜宵时段。可按口味加饭或加肉。',
    price: 28,
    category: '炖汤',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/1-dish.jpg',
    tags: ['招牌', '慢炖'],
    optionGroups: [
      {
        id: 'portion',
        name: '加量选择',
        type: 'multiple',
        options: [
          { id: 'rice', name: '加白饭', priceDelta: 3 },
          { id: 'pork', name: '加肉片', priceDelta: 6 },
        ],
      },
    ],
    recommended: true,
  },
  {
    id: 3,
    name: '冬阴功海鲜汤',
    enName: 'Seafood Tom Yum',
    description: '酸辣泰式汤底配海鲜，入口鲜明开胃。',
    detail: '泰式香料、香茅、南姜与青柠熬出鲜明酸辣汤底，搭配虾、鱿鱼与贝类。可调整辣度，也可额外加海鲜。',
    price: 38,
    category: '泰式菜',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/3-dish.jpg',
    tags: ['酸辣', '海鲜'],
    optionGroups: [
      {
        id: 'spice',
        name: '辣度',
        type: 'single',
        options: [
          { id: 'mild', name: '微辣', priceDelta: 0 },
          { id: 'regular', name: '正常辣', priceDelta: 0 },
          { id: 'extra', name: '加辣', priceDelta: 1 },
        ],
      },
      {
        id: 'add-on',
        name: '加料',
        type: 'multiple',
        options: [
          { id: 'shrimp', name: '加虾', priceDelta: 8 },
          { id: 'mushroom', name: '加蘑菇', priceDelta: 4 },
        ],
      },
    ],
    recommended: true,
  },
  {
    id: 4,
    name: '泰式罗勒叶炒肉',
    enName: 'Pad Krapow Moo',
    description: '罗勒香气浓郁，适合配饭的热炒主菜。',
    detail: '大火快炒猪肉碎、罗勒叶、蒜末与泰式酱汁，香气浓郁，默认微辣，适合作为配饭主菜。',
    price: 22,
    category: '泰式菜',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/4-dish.jpg',
    tags: ['热炒', '微辣'],
    optionGroups: [
      {
        id: 'add-on',
        name: '加料',
        type: 'multiple',
        options: [
          { id: 'egg', name: '加煎蛋', priceDelta: 3 },
          { id: 'rice', name: '加白饭', priceDelta: 3 },
        ],
      },
    ],
  },
  {
    id: 5,
    name: '越南牛肉粉',
    enName: 'Beef Pho',
    description: '清香牛骨汤底，搭配河粉和牛肉片。',
    detail: '牛骨汤底长时间熬煮，配河粉、牛肉片、香草与青柠。汤感清爽，适合想吃主食但不想太重口味的顾客。',
    price: 26,
    category: '越南菜',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/5-dish.jpg',
    tags: ['汤粉', '清爽'],
    optionGroups: [
      {
        id: 'add-on',
        name: '加料',
        type: 'multiple',
        options: [
          { id: 'beef', name: '加牛肉片', priceDelta: 7 },
          { id: 'noodle', name: '加河粉', priceDelta: 4 },
        ],
      },
    ],
  },
  {
    id: 6,
    name: '越南春卷',
    enName: 'Fresh Spring Rolls',
    description: '清爽蔬菜与米纸卷，适合分享的小食。',
    detail: '米纸包裹新鲜蔬菜、香草与爽口配料，搭配蘸酱食用。适合多人分享或作为清爽前菜。',
    price: 18,
    category: '越南菜',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/6-dish.jpg',
    tags: ['小食', '清爽'],
    optionGroups: [
      {
        id: 'sauce',
        name: '蘸酱',
        type: 'single',
        options: [
          { id: 'peanut', name: '花生酱', priceDelta: 0 },
          { id: 'fish', name: '鱼露酸甜酱', priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: 7,
    name: '泰式奶茶',
    enName: 'Thai Milk Tea',
    description: '经典泰茶香气，甜度浓郁顺口。',
    detail: '经典泰式红茶搭配炼奶，茶香明显，口感浓郁。可选择甜度和冰量。',
    price: 12,
    category: '饮料',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/7-dish.jpg',
    tags: ['冰饮'],
    optionGroups: [
      {
        id: 'sweetness',
        name: '甜度',
        type: 'single',
        options: [
          { id: 'less', name: '少甜', priceDelta: 0 },
          { id: 'regular', name: '正常甜', priceDelta: 0 },
        ],
      },
      {
        id: 'ice',
        name: '冰量',
        type: 'single',
        options: [
          { id: 'less', name: '少冰', priceDelta: 0 },
          { id: 'regular', name: '正常冰', priceDelta: 0 },
        ],
      },
    ],
    recommended: true,
  },
  {
    id: 8,
    name: '咸柠七',
    enName: 'Salted Lime 7-Up',
    description: '咸柠檬配汽水，解腻醒胃。',
    detail: '咸柠檬与七喜调制，咸香带酸甜，适合搭配重口味热炒或酸辣汤。',
    price: 9,
    category: '饮料',
    image: 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/8-dish.jpg',
    tags: ['冰饮', '清爽'],
    optionGroups: [
      {
        id: 'ice',
        name: '冰量',
        type: 'single',
        options: [
          { id: 'less', name: '少冰', priceDelta: 0 },
          { id: 'regular', name: '正常冰', priceDelta: 0 },
        ],
      },
    ],
  },
];

export const MENU_CATEGORIES = ['全部', ...Array.from(new Set(MENU_ITEMS.map(item => item.category)))];
