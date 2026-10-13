-- 074 回滚：移除 FSRS 影子字段和调度开关，不影响 SM-2 权威到期时间。
DROP TRIGGER IF EXISTS trg_learning_scheduler_settings_updated ON learning_scheduler_settings;
DROP INDEX IF EXISTS idx_learning_scheduler_settings_mode;
DROP TABLE IF EXISTS learning_scheduler_settings;

DROP INDEX IF EXISTS idx_learning_review_fsrs_due;
ALTER TABLE learning_review_cards
  DROP COLUMN IF EXISTS fsrs_updated_at,
  DROP COLUMN IF EXISTS fsrs_last_review_at,
  DROP COLUMN IF EXISTS fsrs_difficulty,
  DROP COLUMN IF EXISTS fsrs_stability,
  DROP COLUMN IF EXISTS fsrs_due_at,
  DROP COLUMN IF EXISTS fsrs_state;
