-- 050：运动档案图鉴 · 四宫格补充（鞋码 / 磅数）
-- 参考「我的羽球档案」版式：身高 / 体重 / 鞋码 / 磅数 四格。
-- 身高体重来自 user_settings（已有），鞋码与磅数是运动专项数据，落在这里。
-- 幂等：ADD COLUMN IF NOT EXISTS + 约束用 DO 块判存在。

ALTER TABLE sports_profiles
  ADD COLUMN IF NOT EXISTS shoe_size  text,
  ADD COLUMN IF NOT EXISTS tension_lbs numeric(4,1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sports_profiles_tension_range') THEN
    ALTER TABLE sports_profiles
      ADD CONSTRAINT sports_profiles_tension_range
      CHECK (tension_lbs IS NULL OR (tension_lbs > 0 AND tension_lbs <= 40));
  END IF;
END $$;

