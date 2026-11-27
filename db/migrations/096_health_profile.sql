-- 096：健康目标 / 睡眠目标 / 提醒偏好
--
-- 规则引擎写的是「生活方式建议」，不是医疗诊断。这里只存用户显式选择的目标与偏好；
-- 具体判定由 packages/shared/src/health-rules.ts 的纯函数完成，便于测试与版本演进。

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS body_goal text,
  ADD COLUMN IF NOT EXISTS training_days_per_week int,
  ADD COLUMN IF NOT EXISTS sleep_target_minutes int,
  ADD COLUMN IF NOT EXISTS bedtime_target text,
  ADD COLUMN IF NOT EXISTS reminder_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_body_goal_check') THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_body_goal_check
      CHECK (body_goal IS NULL OR body_goal IN ('lose', 'maintain', 'gain'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_training_days_check') THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_training_days_check
      CHECK (training_days_per_week IS NULL OR training_days_per_week BETWEEN 0 AND 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_sleep_target_check') THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_sleep_target_check
      CHECK (sleep_target_minutes IS NULL OR sleep_target_minutes BETWEEN 300 AND 720);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_bedtime_target_check') THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_bedtime_target_check
      CHECK (bedtime_target IS NULL OR bedtime_target ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;

COMMENT ON COLUMN user_settings.body_goal IS '减脂 lose / 维持 maintain / 增肌 gain；NULL 视为 maintain';
COMMENT ON COLUMN user_settings.training_days_per_week IS '每周计划训练天数 0-7，用于个性化蛋白目标';
COMMENT ON COLUMN user_settings.sleep_target_minutes IS '每日睡眠目标分钟数 300-720，默认 450';
COMMENT ON COLUMN user_settings.bedtime_target IS '建议入睡时刻 HH:mm，默认 23:30';
COMMENT ON COLUMN user_settings.reminder_prefs IS '健康提醒偏好 JSON：earlySleep/protein/quietStart/quietEnd';
