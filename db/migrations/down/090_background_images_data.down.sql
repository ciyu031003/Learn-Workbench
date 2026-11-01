-- 回滚 090：删除 090 新增的列与索引（background_images 表本身与 071 的既有列保留）。
DROP INDEX IF EXISTS idx_bg_source_date_desc;
ALTER TABLE background_images
  DROP COLUMN IF EXISTS copyright,
  DROP COLUMN IF EXISTS image_data,
  DROP COLUMN IF EXISTS mime,
  DROP COLUMN IF EXISTS updated_at;
