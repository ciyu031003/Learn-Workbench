-- 043_habit_time_range.sql
-- APP v2 阶段 C（Bug 7c）：习惯增加**可选时间段**。
-- 决策 D5：本期只做「存 + 展示」，不接本地通知（不引入 expo-notifications 与通知权限）。
-- 全部 nullable、纯增量，无需降级。

ALTER TABLE habits ADD COLUMN IF NOT EXISTS remind_start text;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS remind_end text;

-- 时间段为 HH:MM 文本；用 CHECK 做一次轻量格式约束（留空 = 不限定）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habits_remind_start_fmt'
  ) THEN
    ALTER TABLE habits
      ADD CONSTRAINT habits_remind_start_fmt
      CHECK (remind_start IS NULL OR remind_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habits_remind_end_fmt'
  ) THEN
    ALTER TABLE habits
      ADD CONSTRAINT habits_remind_end_fmt
      CHECK (remind_end IS NULL OR remind_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;
