-- 047：食物营养库（v6 P1-3）—— pg_trgm 模糊搜索 + 营养基准库 + 导入审计 + 按克录入
--
-- 只使用公开/可商用数据源（v6 决策 D1）：
--   off     = Open Food Facts（ODbL 1.0：需署名，衍生库同许可开放）
--   usda    = USDA FoodData Central（CC0 公有领域）
--   builtin = 自建中餐常见菜/食材（自有数据，scripts/data/food-builtin.json）
-- 不使用《中国食物成分表》等有版权的数据（该库只在本地做人工参考，不入库、不入 git）。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS food_items (
  id           bigserial PRIMARY KEY,
  source       text NOT NULL,                      -- off | usda | builtin
  source_id    text NOT NULL,                      -- 源侧主键（条码 / fdcId / slug）
  name         text NOT NULL,                      -- 展示名（中文优先）
  name_en      text,
  aliases      text[] NOT NULL DEFAULT '{}',       -- 别名/俗称，模糊搜索命中用
  pinyin       text,                               -- 全拼/首字母（可空）
  category     text,                               -- 主食/蛋白/蔬菜/水果/菜品/饮品…
  meal_tags    text[] NOT NULL DEFAULT '{}',       -- breakfast/lunch/dinner/snack
  basis_amount numeric NOT NULL DEFAULT 100 CHECK (basis_amount > 0),
  basis_unit   text NOT NULL DEFAULT 'g',
  kcal         numeric NOT NULL DEFAULT 0 CHECK (kcal >= 0 AND kcal <= 100000),
  protein_g    numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0 AND protein_g <= 10000),
  carbs_g      numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0 AND carbs_g <= 10000),
  fat_g        numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0 AND fat_g <= 10000),
  fiber_g      numeric,
  sodium_mg    numeric,
  license      text NOT NULL,                      -- ODbL-1.0 | CC0-1.0 | own
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_food_items_name_trgm ON food_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_food_items_aliases   ON food_items USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_food_items_meal_tags ON food_items USING gin (meal_tags);
CREATE INDEX IF NOT EXISTS idx_food_items_category  ON food_items (category);

DROP TRIGGER IF EXISTS trg_food_items_updated ON food_items;
CREATE TRIGGER trg_food_items_updated BEFORE UPDATE ON food_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS food_import_runs (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL,
  license       text NOT NULL,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  rows_in       int NOT NULL DEFAULT 0,
  rows_upserted int NOT NULL DEFAULT 0,
  checksum      text,
  note          text
);

-- 按克/按份量录入（v6 P1-3）：留档实际克数与基准库指向
ALTER TABLE meal_entries ADD COLUMN IF NOT EXISTS grams numeric
  CHECK (grams IS NULL OR (grams > 0 AND grams <= 100000));
ALTER TABLE meal_entries ADD COLUMN IF NOT EXISTS food_item_id bigint;
-- 餐次标签（v6 P1-2）：常用食物按餐次推荐
ALTER TABLE foods ADD COLUMN IF NOT EXISTS meal_tags text[] NOT NULL DEFAULT '{}';
