-- 052：装备图库（v11 P1.5）
-- 抓取的品牌官方白底商品图：图片本体放 COS 桶 /data/learn-workbench/equipment/，这里只登记元数据。
-- 幂等：IF NOT EXISTS；唯一键 (category, brand, model) 让重复抓取可安全 upsert。

CREATE TABLE IF NOT EXISTS equipment_items (
  id          bigserial PRIMARY KEY,
  category    text NOT NULL,               -- badminton-racket / badminton-shoes / badminton-string / badminton-shuttle / badminton-accessory
  brand       text NOT NULL,
  model       text NOT NULL,
  image_path  text NOT NULL,               -- 桶内相对路径：<category>/<file>.webp
  width       integer,
  height      integer,
  bytes       integer,
  source_url  text,                        -- 抓取来源页（审计用）
  source_site text,
  crawled_at  timestamptz,
  is_listed   boolean NOT NULL DEFAULT true,  -- 合规下架开关
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_items ON equipment_items(category, brand, model);
CREATE INDEX IF NOT EXISTS idx_equipment_items_category
  ON equipment_items(category) WHERE is_listed = true;
CREATE INDEX IF NOT EXISTS idx_equipment_items_brand ON equipment_items(brand);

DROP TRIGGER IF EXISTS trg_equipment_items_updated ON equipment_items;
CREATE TRIGGER trg_equipment_items_updated BEFORE UPDATE ON equipment_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

