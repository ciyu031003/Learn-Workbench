-- 095：用户手动添加的食材沉淀到公共食物库
--
-- 目标：手动录入且库里不存在的食材，匿名/登录用户都可以上报；
-- 同名自动去重，其他用户搜索时可直接命中，不必再次手填。
--
-- 只存食物名称/单位/营养值；submitter 仅用于审计，不在搜索接口返回。

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS submitted_by_anon_id text;

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- 同一名称只保留一条用户贡献；不同数据源（builtin/usda/off）仍可同名共存。
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_items_user_name
  ON food_items (lower(name)) WHERE source = 'user';

CREATE INDEX IF NOT EXISTS idx_food_items_user_submitter
  ON food_items (submitted_by_user_id) WHERE submitted_by_user_id IS NOT NULL;
