-- ============================================================================
-- 025：每日任务归属学习领域（web 端领域化）
-- daily_tasks 增加 career_key，默认 'ict'（既有数据归属 ICT 路线）
-- ============================================================================

ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS career_key text NOT NULL DEFAULT 'ict';

CREATE INDEX IF NOT EXISTS idx_daily_tasks_career ON daily_tasks(career_key);
