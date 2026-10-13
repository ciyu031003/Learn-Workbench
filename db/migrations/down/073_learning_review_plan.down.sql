-- 073 回滚：只撤销本迁移新增对象，保留用户作答与复习卡原始数据。
DROP INDEX IF EXISTS idx_learning_review_events_user_created;
DROP TABLE IF EXISTS learning_review_events;

DROP INDEX IF EXISTS idx_learning_review_status_due;
DROP INDEX IF EXISTS idx_learning_review_topic;

ALTER TABLE learning_review_cards
  DROP CONSTRAINT IF EXISTS ck_learning_review_cards_suspended_from;
ALTER TABLE learning_review_cards
  DROP CONSTRAINT IF EXISTS ck_learning_review_cards_status;
ALTER TABLE learning_review_cards
  ADD CONSTRAINT learning_review_cards_status_check
  CHECK (status IN ('learning', 'review', 'mastered'));

ALTER TABLE learning_review_cards
  DROP COLUMN IF EXISTS last_attempt_id,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS suspended_at,
  DROP COLUMN IF EXISTS suspended_from_status,
  DROP COLUMN IF EXISTS schedule_reason,
  DROP COLUMN IF EXISTS algorithm_version,
  DROP COLUMN IF EXISTS topic_key;

DROP INDEX IF EXISTS idx_learning_attempts_user_client;
ALTER TABLE learning_attempts
  DROP COLUMN IF EXISTS client_id;
