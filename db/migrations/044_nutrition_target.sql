-- 044_nutrition_target.sql
-- APP v3 阶段 P3（M6）：热量目标与身体数据。
-- 全部 nullable、纯增量；未填时回落默认目标（不阻塞使用）。
-- 决策 D3：三大营养素用「区间」展示（区间由单值 ±12% 在客户端推导，不占列）。

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS height_cm int;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS birth_year int;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sex text;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS activity_level text;
-- 手动覆盖（NULL = 按 BMR×活动系数自动算）
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS nutrition_target_kcal numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS protein_target_g numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS carbs_target_g numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fat_target_g numeric;

-- 取值范围约束（幂等：先查再建）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_height_cm_range') THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_height_cm_range
      CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 250));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_birth_year_range') THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_birth_year_range
      CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_sex_values') THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_sex_values
      CHECK (sex IS NULL OR sex IN ('male', 'female'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_activity_values') THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_activity_values
      CHECK (activity_level IS NULL OR activity_level IN ('sedentary', 'light', 'moderate', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_target_kcal_range') THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_target_kcal_range
      CHECK (nutrition_target_kcal IS NULL OR (nutrition_target_kcal BETWEEN 800 AND 6000));
  END IF;
END $$;
