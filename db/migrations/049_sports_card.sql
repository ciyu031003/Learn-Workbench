-- 049：运动档案「闪光卡」——战绩与绝技
-- 卡面实时合成需要可量化的战绩：比赛场次 / 胜 / 负（胜率前端算）+ 绝技文案。
-- 装备（球拍类型、球鞋类型…）复用 042 已有的 gear jsonb，公开成绩复用 highlights jsonb。
-- 幂等：ADD COLUMN IF NOT EXISTS；约束用 DO 块判断存在性。

ALTER TABLE sports_profiles
  ADD COLUMN IF NOT EXISTS matches_played integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_move text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sports_profiles_record_nonneg') THEN
    ALTER TABLE sports_profiles
      ADD CONSTRAINT sports_profiles_record_nonneg
      CHECK (matches_played >= 0 AND wins >= 0 AND losses >= 0);
  END IF;
END $$;
