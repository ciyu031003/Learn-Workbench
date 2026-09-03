-- ============================================================================
-- 026：学习日志归属学习领域（域维度打通）
-- log_entries 增加 career_key，默认 'ict'（既有日志归属 ICT）
-- ============================================================================

ALTER TABLE log_entries ADD COLUMN IF NOT EXISTS career_key text NOT NULL DEFAULT 'ict';

CREATE INDEX IF NOT EXISTS idx_log_entries_career ON log_entries(career_key);
