create table if not exists public.menu_items (
  id integer primary key,
  name text not null,
  en_name text not null,
  description text not null,
  detail text not null,
  price numeric(10, 2) not null check (price >= 0),
  category text not null,
  image_url text not null,
  tags text[] not null default '{}',
  recommended boolean not null default false,
  sold_out boolean not null default false,
  
  option_groups jsonb not null default '[]'::jsonb,
  translations jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_active_sort_idx on public.menu_items (active, sort_order, id);
create index if not exists menu_items_category_idx on public.menu_items (category);
alter table public.menu_items add column if not exists translations jsonb not null default '{}'::jsonb;

insert into public.menu_items (
  id, name, en_name, description, detail, price, category, image_url, tags, recommended, sold_out, option_groups, sort_order, active
) values
  (1, '十全大补汤', 'Herbal Pork Stew', '温润药材慢炖汤底，适合夜宵后补气暖胃。', '以党参、当归、黄芪等温补药材慢火熬煮，汤底清润不腻，适合想要暖胃补气的夜宵时段。可按口味加饭或加肉。', 28, '炖汤', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/1-dish.jpg', array['招牌', '慢炖'], true, false, '[{"id":"portion","name":"加量选择","type":"multiple","options":[{"id":"rice","name":"加白饭","priceDelta":3},{"id":"pork","name":"加肉片","priceDelta":6}]}]'::jsonb, 10, true),
  (3, '冬阴功海鲜汤', 'Seafood Tom Yum', '酸辣泰式汤底配海鲜，入口鲜明开胃。', '泰式香料、香茅、南姜与青柠熬出鲜明酸辣汤底，搭配虾、鱿鱼与贝类。可调整辣度，也可额外加海鲜。', 38, '泰式菜', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/3-dish.jpg', array['酸辣', '海鲜'], true, false, '[{"id":"spice","name":"辣度","type":"single","options":[{"id":"mild","name":"微辣","priceDelta":0},{"id":"regular","name":"正常辣","priceDelta":0},{"id":"extra","name":"加辣","priceDelta":1}]},{"id":"add-on","name":"加料","type":"multiple","options":[{"id":"shrimp","name":"加虾","priceDelta":8},{"id":"mushroom","name":"加蘑菇","priceDelta":4}]}]'::jsonb, 20, true),
  (4, '泰式罗勒叶炒肉', 'Pad Krapow Moo', '罗勒香气浓郁，适合配饭的热炒主菜。', '大火快炒猪肉碎、罗勒叶、蒜末与泰式酱汁，香气浓郁，默认微辣，适合作为配饭主菜。', 22, '泰式菜', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/4-dish.jpg', array['热炒', '微辣'], false, false, '[{"id":"add-on","name":"加料","type":"multiple","options":[{"id":"egg","name":"加煎蛋","priceDelta":3},{"id":"rice","name":"加白饭","priceDelta":3}]}]'::jsonb, 30, true),
  (5, '越南牛肉粉', 'Beef Pho', '清香牛骨汤底，搭配河粉和牛肉片。', '牛骨汤底长时间熬煮，配河粉、牛肉片、香草与青柠。汤感清爽，适合想吃主食但不想太重口味的顾客。', 26, '越南菜', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/5-dish.jpg', array['汤粉', '清爽'], false, false, '[{"id":"add-on","name":"加料","type":"multiple","options":[{"id":"beef","name":"加牛肉片","priceDelta":7},{"id":"noodle","name":"加河粉","priceDelta":4}]}]'::jsonb, 40, true),
  (6, '越南春卷', 'Fresh Spring Rolls', '清爽蔬菜与米纸卷，适合分享的小食。', '米纸包裹新鲜蔬菜、香草与爽口配料，搭配蘸酱食用。适合多人分享或作为清爽前菜。', 18, '越南菜', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/6-dish.jpg', array['小食', '清爽'], false, false, '[{"id":"sauce","name":"蘸酱","type":"single","options":[{"id":"peanut","name":"花生酱","priceDelta":0},{"id":"fish","name":"鱼露酸甜酱","priceDelta":0}]}]'::jsonb, 50, true),
  (7, '泰式奶茶', 'Thai Milk Tea', '经典泰茶香气，甜度浓郁顺口。', '经典泰式红茶搭配炼奶，茶香明显，口感浓郁。可选择甜度和冰量。', 12, '饮料', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/7-dish.jpg', array['冰饮'], true, false, '[{"id":"sweetness","name":"甜度","type":"single","options":[{"id":"less","name":"少甜","priceDelta":0},{"id":"regular","name":"正常甜","priceDelta":0}]},{"id":"ice","name":"冰量","type":"single","options":[{"id":"less","name":"少冰","priceDelta":0},{"id":"regular","name":"正常冰","priceDelta":0}]}]'::jsonb, 60, true),
  (8, '咸柠七', 'Salted Lime 7-Up', '咸柠檬配汽水，解腻醒胃。', '咸柠檬与七喜调制，咸香带酸甜，适合搭配重口味热炒或酸辣汤。', 9, '饮料', 'https://dknmznkimydnkcmbejqi.supabase.co/storage/v1/object/public/menu-items/8-dish.jpg', array['冰饮', '清爽'], false, false, '[{"id":"ice","name":"冰量","type":"single","options":[{"id":"less","name":"少冰","priceDelta":0},{"id":"regular","name":"正常冰","priceDelta":0}]}]'::jsonb, 70, true)
on conflict (id) do update set
  name = excluded.name,
  en_name = excluded.en_name,
  description = excluded.description,
  detail = excluded.detail,
  price = excluded.price,
  category = excluded.category,
  image_url = excluded.image_url,
  tags = excluded.tags,
  recommended = excluded.recommended,
  sold_out = excluded.sold_out,
  option_groups = excluded.option_groups,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

update public.menu_items as item
set translations = seed.translations,
    updated_at = now()
from (
  values
    (1, $${
      "en": {
        "name": "Herbal Pork Stew",
        "enName": "",
        "description": "A gentle herbal slow-cooked soup for late-night warmth and nourishment.",
        "detail": "Slow-cooked with codonopsis, angelica, astragalus, and other warming herbs. The broth is clear and light, ideal when you want something soothing at night. Add rice or pork slices to taste.",
        "category": "Soups",
        "tags": ["Signature", "Slow-cooked"],
        "optionGroups": [{"id":"portion","name":"Add-ons","options":[{"id":"rice","name":"Add rice"},{"id":"pork","name":"Add pork slices"}]}]
      },
      "th": {
        "name": "ซุปหมูสมุนไพร",
        "enName": "",
        "description": "ซุปสมุนไพรเคี่ยวช้า อุ่นท้อง เหมาะสำหรับมื้อดึก",
        "detail": "เคี่ยวช้าด้วยตังเซียม ตังกุย หวงฉี และสมุนไพรบำรุงอื่นๆ น้ำซุปใส ไม่เลี่ยน เหมาะสำหรับมื้อดึกที่ต้องการความอุ่นสบาย สามารถเพิ่มข้าวหรือหมูสไลซ์ได้",
        "category": "ซุป",
        "tags": ["ซิกเนเจอร์", "เคี่ยวช้า"],
        "optionGroups": [{"id":"portion","name":"ตัวเลือกเพิ่ม","options":[{"id":"rice","name":"เพิ่มข้าว"},{"id":"pork","name":"เพิ่มหมูสไลซ์"}]}]
      },
      "vi": {
        "name": "Súp heo thảo mộc",
        "enName": "",
        "description": "Súp thảo mộc hầm chậm, ấm bụng và nhẹ nhàng cho bữa khuya.",
        "detail": "Hầm chậm với đảng sâm, đương quy, hoàng kỳ và các vị thuốc bổ ấm. Nước súp trong, nhẹ, phù hợp khi muốn ăn khuya thanh dịu. Có thể thêm cơm hoặc thịt heo lát.",
        "category": "Súp",
        "tags": ["Đặc trưng", "Hầm chậm"],
        "optionGroups": [{"id":"portion","name":"Tùy chọn thêm","options":[{"id":"rice","name":"Thêm cơm"},{"id":"pork","name":"Thêm thịt heo lát"}]}]
      }
    }$$::jsonb),
    (3, $${
      "en": {
        "name": "Seafood Tom Yum",
        "enName": "",
        "description": "Bright spicy-sour Thai broth with seafood.",
        "detail": "Thai aromatics, lemongrass, galangal, and lime create a vivid spicy-sour broth with prawns, squid, and shellfish. Spice level and extra seafood can be adjusted.",
        "category": "Thai Food",
        "tags": ["Spicy-sour", "Seafood"],
        "optionGroups": [{"id":"spice","name":"Spice level","options":[{"id":"mild","name":"Mild"},{"id":"regular","name":"Regular spicy"},{"id":"extra","name":"Extra spicy"}]},{"id":"add-on","name":"Add-ons","options":[{"id":"shrimp","name":"Add prawns"},{"id":"mushroom","name":"Add mushrooms"}]}]
      },
      "th": {
        "name": "ต้มยำทะเล",
        "enName": "",
        "description": "ซุปต้มยำรสเปรี้ยวเผ็ดพร้อมซีฟู้ด",
        "detail": "สมุนไพรไทย ตะไคร้ ข่า และมะนาวให้รสเปรี้ยวเผ็ดชัดเจน เสิร์ฟพร้อมกุ้ง ปลาหมึก และหอย ปรับระดับความเผ็ดและเพิ่มซีฟู้ดได้",
        "category": "อาหารไทย",
        "tags": ["เปรี้ยวเผ็ด", "ซีฟู้ด"],
        "optionGroups": [{"id":"spice","name":"ระดับความเผ็ด","options":[{"id":"mild","name":"เผ็ดน้อย"},{"id":"regular","name":"เผ็ดปกติ"},{"id":"extra","name":"เพิ่มเผ็ด"}]},{"id":"add-on","name":"เพิ่มพิเศษ","options":[{"id":"shrimp","name":"เพิ่มกุ้ง"},{"id":"mushroom","name":"เพิ่มเห็ด"}]}]
      },
      "vi": {
        "name": "Tom Yum hải sản",
        "enName": "",
        "description": "Nước súp Thái chua cay rõ vị cùng hải sản.",
        "detail": "Hương liệu Thái, sả, riềng và chanh tạo nước súp chua cay nổi bật, ăn cùng tôm, mực và nghêu sò. Có thể chỉnh độ cay và thêm hải sản.",
        "category": "Món Thái",
        "tags": ["Chua cay", "Hải sản"],
        "optionGroups": [{"id":"spice","name":"Độ cay","options":[{"id":"mild","name":"Ít cay"},{"id":"regular","name":"Cay vừa"},{"id":"extra","name":"Thêm cay"}]},{"id":"add-on","name":"Topping thêm","options":[{"id":"shrimp","name":"Thêm tôm"},{"id":"mushroom","name":"Thêm nấm"}]}]
      }
    }$$::jsonb),
    (4, $${
      "en": {"name":"Pad Krapow Moo","enName":"","description":"Fragrant Thai basil stir-fry, perfect with rice.","detail":"Minced pork, basil leaves, garlic, and Thai sauce are quickly stir-fried over high heat. Lightly spicy by default and ideal as a rice dish.","category":"Thai Food","tags":["Stir-fry","Mild spicy"],"optionGroups":[{"id":"add-on","name":"Add-ons","options":[{"id":"egg","name":"Add fried egg"},{"id":"rice","name":"Add rice"}]}]},
      "th": {"name":"ผัดกะเพราหมู","enName":"","description":"ผัดกะเพราหอมเข้ม เหมาะทานคู่ข้าว","detail":"หมูสับ ใบกะเพรา กระเทียม และซอสไทย ผัดไฟแรงจนหอม ค่าเริ่มต้นเผ็ดน้อย เหมาะเป็นจานหลักคู่ข้าว","category":"อาหารไทย","tags":["ผัดร้อน","เผ็ดน้อย"],"optionGroups":[{"id":"add-on","name":"เพิ่มพิเศษ","options":[{"id":"egg","name":"เพิ่มไข่ดาว"},{"id":"rice","name":"เพิ่มข้าว"}]}]},
      "vi": {"name":"Thịt heo xào húng quế Thái","enName":"","description":"Món xào thơm mùi húng quế Thái, hợp ăn với cơm.","detail":"Thịt heo băm, lá húng quế, tỏi và sốt Thái được xào nhanh lửa lớn. Mặc định hơi cay, phù hợp làm món chính ăn với cơm.","category":"Món Thái","tags":["Món xào","Hơi cay"],"optionGroups":[{"id":"add-on","name":"Topping thêm","options":[{"id":"egg","name":"Thêm trứng chiên"},{"id":"rice","name":"Thêm cơm"}]}]}
    }$$::jsonb),
    (5, $${
      "en": {"name":"Beef Pho","enName":"","description":"Clear beef bone broth with rice noodles and sliced beef.","detail":"Long-simmered beef bone broth with rice noodles, sliced beef, herbs, and lime. Light and refreshing when you want a filling but not heavy meal.","category":"Vietnamese Food","tags":["Noodle soup","Refreshing"],"optionGroups":[{"id":"add-on","name":"Add-ons","options":[{"id":"beef","name":"Add sliced beef"},{"id":"noodle","name":"Add noodles"}]}]},
      "th": {"name":"เฝอเนื้อ","enName":"","description":"น้ำซุปกระดูกเนื้อหอมใส พร้อมเส้นเฝอและเนื้อสไลซ์","detail":"น้ำซุปกระดูกเนื้อเคี่ยวนาน เสิร์ฟกับเส้นเฝอ เนื้อสไลซ์ สมุนไพร และมะนาว รสเบาสดชื่น เหมาะเมื่ออยากทานอาหารหลักที่ไม่หนักเกินไป","category":"อาหารเวียดนาม","tags":["ก๋วยเตี๋ยวน้ำ","สดชื่น"],"optionGroups":[{"id":"add-on","name":"เพิ่มพิเศษ","options":[{"id":"beef","name":"เพิ่มเนื้อสไลซ์"},{"id":"noodle","name":"เพิ่มเส้นเฝอ"}]}]},
      "vi": {"name":"Phở bò","enName":"","description":"Nước dùng xương bò thanh thơm cùng phở và bò lát.","detail":"Nước dùng xương bò hầm lâu, ăn cùng phở, bò lát, rau thơm và chanh. Vị thanh nhẹ, phù hợp khi muốn ăn no nhưng không quá đậm.","category":"Món Việt","tags":["Phở nước","Thanh nhẹ"],"optionGroups":[{"id":"add-on","name":"Topping thêm","options":[{"id":"beef","name":"Thêm bò lát"},{"id":"noodle","name":"Thêm phở"}]}]}
    }$$::jsonb),
    (6, $${
      "en": {"name":"Fresh Spring Rolls","enName":"","description":"Fresh vegetables wrapped in rice paper, great for sharing.","detail":"Rice paper wraps fresh vegetables, herbs, and refreshing fillings, served with dipping sauce. Ideal for sharing or as a light starter.","category":"Vietnamese Food","tags":["Snack","Refreshing"],"optionGroups":[{"id":"sauce","name":"Dipping sauce","options":[{"id":"peanut","name":"Peanut sauce"},{"id":"fish","name":"Sweet-sour fish sauce"}]}]},
      "th": {"name":"ปอเปี๊ยะสดเวียดนาม","enName":"","description":"ผักสดและแผ่นแป้งข้าว เหมาะเป็นของว่างแบ่งกันทาน","detail":"แผ่นแป้งข้าวห่อผักสด สมุนไพร และไส้รสสดชื่น เสิร์ฟกับน้ำจิ้ม เหมาะสำหรับแบ่งกันหรือเป็นจานเรียกน้ำย่อยเบาๆ","category":"อาหารเวียดนาม","tags":["ของว่าง","สดชื่น"],"optionGroups":[{"id":"sauce","name":"น้ำจิ้ม","options":[{"id":"peanut","name":"ซอสถั่ว"},{"id":"fish","name":"น้ำปลาหวานเปรี้ยว"}]}]},
      "vi": {"name":"Gỏi cuốn","enName":"","description":"Rau tươi cuốn bánh tráng, món nhẹ phù hợp để chia sẻ.","detail":"Bánh tráng cuốn rau tươi, rau thơm và nhân thanh mát, dùng cùng nước chấm. Phù hợp để chia sẻ hoặc làm món khai vị nhẹ.","category":"Món Việt","tags":["Món nhẹ","Thanh mát"],"optionGroups":[{"id":"sauce","name":"Nước chấm","options":[{"id":"peanut","name":"Sốt đậu phộng"},{"id":"fish","name":"Nước mắm chua ngọt"}]}]}
    }$$::jsonb),
    (7, $${
      "en": {"name":"Thai Milk Tea","enName":"","description":"Classic Thai tea aroma with a rich, smooth sweetness.","detail":"Classic Thai black tea with condensed milk. Bold tea aroma and rich texture, with sweetness and ice level options.","category":"Drinks","tags":["Iced drink"],"optionGroups":[{"id":"sweetness","name":"Sweetness","options":[{"id":"less","name":"Less sweet"},{"id":"regular","name":"Regular sweet"}]},{"id":"ice","name":"Ice level","options":[{"id":"less","name":"Less ice"},{"id":"regular","name":"Regular ice"}]}]},
      "th": {"name":"ชาไทยนม","enName":"","description":"กลิ่นชาไทยคลาสสิก หวานมันกลมกล่อม","detail":"ชาแดงไทยคลาสสิกผสมนมข้น กลิ่นชาชัด รสเข้มข้น สามารถเลือกระดับความหวานและน้ำแข็งได้","category":"เครื่องดื่ม","tags":["เครื่องดื่มเย็น"],"optionGroups":[{"id":"sweetness","name":"ระดับความหวาน","options":[{"id":"less","name":"หวานน้อย"},{"id":"regular","name":"หวานปกติ"}]},{"id":"ice","name":"ระดับน้ำแข็ง","options":[{"id":"less","name":"น้ำแข็งน้อย"},{"id":"regular","name":"น้ำแข็งปกติ"}]}]},
      "vi": {"name":"Trà sữa Thái","enName":"","description":"Hương trà Thái cổ điển, ngọt béo và mượt.","detail":"Trà đỏ Thái cổ điển pha cùng sữa đặc, hương trà rõ và vị đậm. Có thể chọn độ ngọt và lượng đá.","category":"Đồ uống","tags":["Đồ uống đá"],"optionGroups":[{"id":"sweetness","name":"Độ ngọt","options":[{"id":"less","name":"Ít ngọt"},{"id":"regular","name":"Ngọt thường"}]},{"id":"ice","name":"Lượng đá","options":[{"id":"less","name":"Ít đá"},{"id":"regular","name":"Đá thường"}]}]}
    }$$::jsonb),
    (8, $${
      "en": {"name":"Salted Lime 7-Up","enName":"","description":"Salted lime with soda, refreshing and cuts through richness.","detail":"Salted lime mixed with 7-Up for a salty, sour, and sweet drink. Great with bold stir-fries or spicy-sour soups.","category":"Drinks","tags":["Iced drink","Refreshing"],"optionGroups":[{"id":"ice","name":"Ice level","options":[{"id":"less","name":"Less ice"},{"id":"regular","name":"Regular ice"}]}]},
      "th": {"name":"มะนาวดองเซเว่นอัพ","enName":"","description":"มะนาวดองผสมโซดา สดชื่น ตัดเลี่ยน","detail":"มะนาวดองผสมเซเว่นอัพ ให้รสเค็ม เปรี้ยว หวาน เหมาะกับอาหารผัดรสจัดหรือซุปเปรี้ยวเผ็ด","category":"เครื่องดื่ม","tags":["เครื่องดื่มเย็น","สดชื่น"],"optionGroups":[{"id":"ice","name":"ระดับน้ำแข็ง","options":[{"id":"less","name":"น้ำแข็งน้อย"},{"id":"regular","name":"น้ำแข็งปกติ"}]}]},
      "vi": {"name":"7-Up chanh muối","enName":"","description":"Chanh muối pha soda, thanh mát và đỡ ngấy.","detail":"Chanh muối pha cùng 7-Up, vị mặn thơm chua ngọt. Hợp dùng với món xào đậm vị hoặc súp chua cay.","category":"Đồ uống","tags":["Đồ uống đá","Thanh mát"],"optionGroups":[{"id":"ice","name":"Lượng đá","options":[{"id":"less","name":"Ít đá"},{"id":"regular","name":"Đá thường"}]}]}
    }$$::jsonb)
) as seed(id, translations)
where item.id = seed.id;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  order_type text not null,
  payment_method text not null,
  customer_name text not null,
  customer_phone text not null,
  table_no text,
  delivery_address text,
  note text,
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null default 0,
  service_charge numeric(10, 2) not null,
  total numeric(10, 2) not null,
  status text not null default 'pending_confirm',
  payment_status text not null default 'pay_at_counter',
  payment_review_status text not null default 'not_required',
  receipt_url text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  notification_status text not null default 'pending',
  telegram_chat_id text,
  telegram_message_id integer,
  notified_at timestamptz,
  paid_at timestamptz,
  source_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists payment_status text not null default 'pay_at_counter';
alter table public.orders add column if not exists payment_review_status text not null default 'not_required';
alter table public.orders add column if not exists receipt_url text;
alter table public.orders add column if not exists stripe_checkout_session_id text;
alter table public.orders add column if not exists stripe_payment_intent_id text;
alter table public.orders add column if not exists telegram_chat_id text;
alter table public.orders add column if not exists telegram_message_id integer;
alter table public.orders add column if not exists notified_at timestamptz;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists user_id uuid;
alter table public.orders add column if not exists coupon_id uuid;
alter table public.orders add column if not exists discount_amount numeric(10, 2) not null default 0;
alter table public.orders add column if not exists payable_total numeric(10, 2);
alter table public.orders add column if not exists delivery_fee numeric(10, 2) not null default 0;
alter table public.orders add column if not exists payment_review_token text;
alter table public.orders add column if not exists reviewed_at timestamptz;

update public.orders set payable_total = total where payable_total is null;

update public.orders set payment_method = 'stripe' where payment_method = 'online';
update public.orders set payment_method = 'tng' where payment_method = 'ewallet';
update public.orders set status = 'pending_confirm' where status in ('pending', 'awaiting_payment', 'pending_review');
update public.orders set status = 'cancelled' where status in ('payment_rejected', 'rejected');

alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders drop constraint if exists orders_payment_review_status_check;
alter table public.orders drop constraint if exists orders_notification_status_check;

alter table public.orders
  add constraint orders_order_type_check check (order_type in ('dinein', 'takeaway'));

alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('cash', 'tng', 'stripe', 'wallet'));

alter table public.orders
  add constraint orders_status_check check (status in ('pending_confirm', 'preparing', 'delivering', 'delivered', 'completed', 'cancelled'));

alter table public.orders
  add constraint orders_payment_status_check check (payment_status in ('pay_at_counter', 'pending_review', 'awaiting_payment', 'paid'));

alter table public.orders
  add constraint orders_payment_review_status_check check (payment_review_status in ('not_required', 'pending', 'approved', 'rejected'));

alter table public.orders
  add constraint orders_notification_status_check check (notification_status in ('pending', 'sent', 'failed'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id text not null,
  name text not null,
  unit_base_price numeric(10, 2),
  unit_options_total numeric(10, 2) not null default 0,
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10, 2) not null,
  selected_options jsonb not null default '[]'::jsonb,
  item_note text,
  created_at timestamptz not null default now()
);

alter table public.order_items add column if not exists unit_base_price numeric(10, 2);
alter table public.order_items add column if not exists unit_options_total numeric(10, 2) not null default 0;
alter table public.order_items add column if not exists selected_options jsonb not null default '[]'::jsonb;
alter table public.order_items add column if not exists item_note text;

update public.order_items set unit_base_price = unit_price where unit_base_price is null;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_stripe_checkout_session_idx on public.orders (stripe_checkout_session_id);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_coupon_id_idx on public.orders (coupon_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

create table if not exists public.telegram_users (
  telegram_user_id text primary key,
  username text,
  first_name text,
  last_name text,
  is_admin boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_users add column if not exists username text;
alter table public.telegram_users add column if not exists first_name text;
alter table public.telegram_users add column if not exists last_name text;
alter table public.telegram_users add column if not exists is_admin boolean not null default false;
alter table public.telegram_users add column if not exists first_seen_at timestamptz not null default now();
alter table public.telegram_users add column if not exists last_seen_at timestamptz not null default now();
alter table public.telegram_users add column if not exists updated_at timestamptz not null default now();

create index if not exists telegram_users_is_admin_idx on public.telegram_users (is_admin);
create index if not exists telegram_users_last_seen_idx on public.telegram_users (last_seen_at desc);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  display_phone text not null,
  name text,
  email text,
  birthday date,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.users add column if not exists email text;
alter table public.users add column if not exists birthday date;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  balance numeric(10, 2) not null default 0 check (balance >= 0),
  currency text not null default 'MYR',
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  method text not null,
  amount numeric(10, 2) not null check (amount > 0),
  status text not null default 'pending',
  note text,
  receipt_url text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  review_token text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions drop constraint if exists wallet_transactions_method_check;
alter table public.wallet_transactions drop constraint if exists wallet_transactions_status_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check check (type in ('recharge', 'payment', 'refund', 'adjustment'));

alter table public.wallet_transactions
  add constraint wallet_transactions_method_check check (method in ('stripe', 'tng', 'manual', 'wallet'));

alter table public.wallet_transactions
  add constraint wallet_transactions_status_check check (status in ('pending', 'succeeded', 'rejected', 'failed'));

create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null default '默认地址',
  recipient_name text not null,
  phone text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  discount_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.coupons add column if not exists discount_amount numeric(10, 2) not null default 0;

create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  status text not null default 'available',
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_coupons add column if not exists used_at timestamptz;

alter table public.orders
  drop constraint if exists orders_user_id_fkey;

alter table public.orders
  add constraint orders_user_id_fkey foreign key (user_id) references public.users(id) on delete set null;

alter table public.orders
  drop constraint if exists orders_coupon_id_fkey;

alter table public.orders
  add constraint orders_coupon_id_fkey foreign key (coupon_id) references public.user_coupons(id) on delete set null;

create index if not exists user_sessions_token_hash_idx on public.user_sessions (token_hash);
create index if not exists user_sessions_expires_at_idx on public.user_sessions (expires_at);
create index if not exists wallets_user_id_idx on public.wallets (user_id);
create index if not exists wallet_transactions_user_id_idx on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_transactions_status_idx on public.wallet_transactions (status);
create index if not exists user_addresses_user_id_idx on public.user_addresses (user_id);
create index if not exists user_coupons_user_id_idx on public.user_coupons (user_id);

create or replace function public.process_wallet_payment(
  user_id_input uuid,
  order_id_input uuid,
  amount_input numeric
)
returns void
language plpgsql
security definer
as $$
declare
  current_balance numeric(10, 2);
begin
  select balance
  into current_balance
  from public.wallets
  where user_id = user_id_input
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if current_balance < amount_input then
    raise exception 'Insufficient wallet balance';
  end if;

  update public.wallets
  set balance = round((balance - amount_input)::numeric, 2),
      updated_at = now()
  where user_id = user_id_input;

  insert into public.wallet_transactions (user_id, type, method, amount, status, note, completed_at)
  values (user_id_input, 'payment', 'wallet', amount_input, 'succeeded', 'Order payment ' || order_id_input::text, now());
end;
$$;

create or replace function public.approve_wallet_recharge(
  transaction_id_input uuid,
  review_token_input text default null,
  stripe_session_id_input text default null,
  stripe_payment_intent_id_input text default null
)
returns void
language plpgsql
security definer
as $$
declare
  tx public.wallet_transactions%rowtype;
begin
  select *
  into tx
  from public.wallet_transactions
  where id = transaction_id_input
  for update;

  if not found then
    raise exception 'Wallet transaction not found';
  end if;

  if tx.status = 'succeeded' then
    return;
  end if;

  if tx.status <> 'pending' then
    raise exception 'Wallet transaction is not pending';
  end if;

  if review_token_input is not null and tx.review_token is distinct from review_token_input then
    raise exception 'Invalid review token';
  end if;

  update public.wallets
  set balance = round((balance + tx.amount)::numeric, 2),
      updated_at = now()
  where user_id = tx.user_id;

  if not found then
    insert into public.wallets (user_id, balance, currency)
    values (tx.user_id, tx.amount, 'MYR');
  end if;

  update public.wallet_transactions
  set status = 'succeeded',
      stripe_checkout_session_id = coalesce(stripe_session_id_input, stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id_input, stripe_payment_intent_id),
      completed_at = now()
  where id = tx.id;
end;
$$;

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('menu-items', 'menu-items', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read payment receipts" on storage.objects;
drop policy if exists "Public read menu item images" on storage.objects;

create policy "Public read payment receipts"
on storage.objects for select
using (bucket_id = 'payment-receipts');

create policy "Public read menu item images"
on storage.objects for select
using (bucket_id = 'menu-items');

create table if not exists public.payment_settings (
  id text primary key default 'default',
  tng_account_name text not null default '',
  tng_account_number text not null default '',
  tng_qr_image_url text not null default '',
  updated_at timestamptz not null default now(),
  constraint payment_settings_singleton check (id = 'default'),
  constraint payment_settings_tng_qr_url_check check (
    tng_qr_image_url = ''
    or tng_qr_image_url ~ '^https?://'
    or tng_qr_image_url ~ '^/'
  )
);

alter table public.payment_settings enable row level security;

drop policy if exists "Payment settings are publicly readable" on public.payment_settings;
create policy "Payment settings are publicly readable"
on public.payment_settings for select
using (id = 'default');

grant select on public.payment_settings to anon, authenticated;

insert into public.payment_settings (id)
values ('default')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-assets',
  'payment-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
