USE recipe_api;

-- 1. Seed Categories
INSERT INTO categories (id, name, description) VALUES
  (1, 'อาหารคาวไทย', 'สูตรอาหารไทยรสชาติต้นตำรับ เข้มข้น กลมกล่อม'),
  (2, 'ของหวานและเบเกอรี่', 'ขนมหวาน ขนมไทย และเบเกอรี่ทำง่าย'),
  (3, 'อาหารเพื่อสุขภาพ', 'เมนูอาหารคลีน แคลอรี่ต่ำ อุดมไปด้วยโปรตีน');

-- 2. Seed Users
INSERT INTO users (id, username, email, role) VALUES
  (1, 'chef_somchai', 'somchai.chef@example.com', 'chef'),
  (2, 'foodie_somying', 'somying.eat@example.com', 'member'),
  (3, 'admin_wittawas', 'admin@example.com', 'admin');

-- 3. Seed Ingredients
INSERT INTO ingredients (id, name, unit_type) VALUES
  (1, 'หมูสับ', 'grams'),
  (2, 'ใบกะเพรา', 'grams'),
  (3, 'พริกขี้หนู', 'pieces'),
  (4, 'กระเทียม', 'cloves'),
  (5, 'ไข่ไก่', 'pieces'),
  (6, 'กะทิ', 'ml'),
  (7, 'ข้าวเหนียว', 'grams'),
  (8, 'มะม่วงน้ำดอกไม้', 'pieces');

-- 4. Seed Recipes
INSERT INTO recipes (id, name, category_id, author_id, instructions, cook_time_minutes, difficulty) VALUES
  (1, 'ผัดกะเพราหมูสับไข่ดาว', 1, 1, '1. โขลกพริกกระเทียม 2. ผัดหมูสับให้สุก 3. ปรุงรสและใส่ใบกะเพรา 4. ทอดไข่ดาวกรอบ', 15, 'easy'),
  (2, 'ข้าวเหนียวมะม่วงกะทิสด', 2, 1, '1. มูนข้าวเหนียวกับกะทิและน้ำตาล 2. ปอกมะม่วงหั่นชิ้น 3. ราดน้ำกะทิพร้อมเสิร์ฟ', 30, 'medium'),
  (3, 'อกไก่ผัดพริกไทยดำคลีน', 3, 2, '1. หมักอกไก่ด้วยพริกไทยดำ 2. ผัดกับน้ำซุปโดยไม่ใช้น้ำมันจนสุก', 20, 'easy');

-- 5. Seed Recipe Ingredients
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES
  (1, 1, 200, 'grams'),
  (1, 2, 30, 'grams'),
  (1, 3, 5, 'pieces'),
  (1, 4, 4, 'cloves'),
  (1, 5, 1, 'piece'),
  (2, 6, 250, 'ml'),
  (2, 7, 300, 'grams'),
  (2, 8, 1, 'piece');

-- 6. Seed Ratings
INSERT INTO ratings (recipe_id, user_id, rating_score, review_comment) VALUES
  (1, 2, 5, 'สูตรนี้อร่อยมาก รสชาติจัดจ้านกำลังดี!'),
  (2, 2, 5, 'ข้าวเหนียวมูนหวานมัน มะม่วงหวานฉ่ำ'),
  (1, 3, 4, 'ผัดง่าย รวดเร็ว เหมาะกับมื้อด่วน');
