-- 回滚 095：移除公共食物库的审核/来源字段与去重索引
-- 注意：用户已贡献的 food_items 行不删除（source='user' 仍然可用）。
DROP INDEX IF EXISTS idx_food_items_user_submitter;
DROP INDEX IF EXISTS uq_food_items_user_name;

ALTER TABLE food_items DROP COLUMN IF EXISTS submitted_at;
ALTER TABLE food_items DROP COLUMN IF EXISTS submitted_by_anon_id;
ALTER TABLE food_items DROP COLUMN IF EXISTS submitted_by_user_id;
ALTER TABLE food_items DROP COLUMN IF EXISTS status;
