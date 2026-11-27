-- 回滚 096：移除健康目标 / 睡眠目标 / 提醒偏好
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_body_goal_check;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_training_days_check;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_sleep_target_check;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_bedtime_target_check;

ALTER TABLE user_settings DROP COLUMN IF EXISTS reminder_prefs;
ALTER TABLE user_settings DROP COLUMN IF EXISTS bedtime_target;
ALTER TABLE user_settings DROP COLUMN IF EXISTS sleep_target_minutes;
ALTER TABLE user_settings DROP COLUMN IF EXISTS training_days_per_week;
ALTER TABLE user_settings DROP COLUMN IF EXISTS body_goal;
