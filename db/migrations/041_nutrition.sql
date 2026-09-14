-- 041：Nutrition v1（轻量）——foods（常用食物库）+ meal_entries（每日饮食条目）
-- 本期先手输 + 保存常用食物；圆环/进度条展示 Kcal 与三大营养素。
-- 全局种子食物 user_id 为 NULL，用户自定义食物按 user_id 隔离。

CREATE TABLE IF NOT EXISTS foods (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,  -- NULL = 全局常用
  name       text NOT NULL,
  unit       text NOT NULL DEFAULT '份',
  kcal       numeric NOT NULL DEFAULT 0 CHECK (kcal >= 0 AND kcal <= 10000),
  protein_g  numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0 AND protein_g <= 1000),
  carbs_g    numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0 AND carbs_g <= 1000),
  fat_g      numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0 AND fat_g <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 同名食物每用户唯一（全局种子用 name 唯一）
CREATE UNIQUE INDEX IF NOT EXISTS uq_foods_user_name
  ON foods(user_id, lower(name)) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_foods_global_name
  ON foods(lower(name)) WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS meal_entries (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id    text,
  log_date   date NOT NULL DEFAULT CURRENT_DATE,
  meal       text NOT NULL DEFAULT 'lunch'
             CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  food_id    bigint REFERENCES foods(id) ON DELETE SET NULL,
  name       text NOT NULL,
  amount     numeric NOT NULL DEFAULT 1 CHECK (amount > 0 AND amount <= 1000),
  unit       text NOT NULL DEFAULT '份',
  kcal       numeric NOT NULL DEFAULT 0 CHECK (kcal >= 0 AND kcal <= 100000),
  protein_g  numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0 AND protein_g <= 10000),
  carbs_g    numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0 AND carbs_g <= 10000),
  fat_g      numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0 AND fat_g <= 10000),
  deleted_at timestamptz,
  client_id  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_entries_user_date
  ON meal_entries(user_id, log_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meal_entries_anon
  ON meal_entries(anon_id, log_date) WHERE deleted_at IS NULL AND user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_entries_client
  ON meal_entries(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_foods_updated ON foods;
CREATE TRIGGER trg_foods_updated BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_meal_entries_updated ON meal_entries;
CREATE TRIGGER trg_meal_entries_updated BEFORE UPDATE ON meal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 全局常用食物种子（幂等）
INSERT INTO foods (user_id, name, unit, kcal, protein_g, carbs_g, fat_g) VALUES
  (NULL, '米饭',   '碗', 232, 4.8, 51.6, 0.6),
  (NULL, '馒头',   '个', 223, 7.0, 47.0, 1.1),
  (NULL, '鸡蛋',   '个', 78,  6.3, 0.6,  5.3),
  (NULL, '牛奶',   '杯', 134, 6.8, 10.0, 7.2),
  (NULL, '鸡胸肉', '份', 165, 31.0, 0.0, 3.6),
  (NULL, '牛肉',   '份', 250, 26.0, 0.0, 15.0),
  (NULL, '三文鱼', '份', 208, 20.0, 0.0, 13.0),
  (NULL, '西兰花', '份', 55,  3.7, 11.0, 0.6),
  (NULL, '苹果',   '个', 95,  0.5, 25.0, 0.3),
  (NULL, '香蕉',   '根', 105, 1.3, 27.0, 0.4),
  (NULL, '酸奶',   '杯', 149, 8.5, 11.4, 8.0),
  (NULL, '燕麦',   '份', 150, 5.0, 27.0, 3.0)
ON CONFLICT DO NOTHING;