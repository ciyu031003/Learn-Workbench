-- 090: Bing 壁纸图片入库（P10 · Node 爬虫重做）
--
-- 背景：专注计时「Bing 壁纸」一直不变。根因是生产环境只有 assets/backgrounds/bing/index.json、
-- 没有 jpg 文件（/api/background/img 404），且 python 爬虫从未被 cron 调度、容器内没有 psql。
-- 本迁移把图片二进制与展示元数据都放进 background_images：路由优先读库，彻底摆脱文件系统。
--
-- 幂等：ADD COLUMN IF NOT EXISTS；唯一约束 UNIQUE(source, image_date) 在 071 已存在。
ALTER TABLE background_images
  ADD COLUMN IF NOT EXISTS copyright   text,
  ADD COLUMN IF NOT EXISTS image_data  bytea,
  ADD COLUMN IF NOT EXISTS mime        text NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- 读路径：先按日期精确命中，再取最近一条可展示的图（image_data 非空）。
CREATE INDEX IF NOT EXISTS idx_bg_source_date_desc
  ON background_images(source, image_date DESC);

COMMENT ON COLUMN background_images.image_data IS 'Bing 每日壁纸原图（1920x1080 jpg），由 /api/internal/cron?job=wallpaper 写入';
COMMENT ON COLUMN background_images.copyright  IS 'Bing 版权说明（展示用，保留署名）';
COMMENT ON COLUMN background_images.mime       IS '图片 MIME，默认 image/jpeg';
