-- 073: 掌握度与间隔复习 Phase 4
--
-- 目标：
--   1. 作答可幂等重放（离线补交不会重复推进复习卡）；
--   2. 复习卡支持延后、暂停、恢复、完成；
--   3. 保留算法版本、调度原因和知识点回链，后续可平滑迁移到 FSRS；
--   4. 用户操作以事件表记录 client_id，服务端是跨设备权威状态。
--
-- 兼容性：只新增列、约束、索引和事件表，不改写历史作答或复习卡数据。
-- 回滚契约见 db/migrations/down/073_learning_review_plan.down.sql。

ALTER TABLE learning_attempts
  ADD COLUMN IF NOT EXISTS client_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_attempts_user_client
  ON learning_attempts(user_id, client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE learning_review_cards
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS algorithm_version text NOT NULL DEFAULT 'sm2-lwb-v1',
  ADD COLUMN IF NOT EXISTS schedule_reason text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS suspended_from_status text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_id bigint REFERENCES learning_attempts(id) ON DELETE SET NULL;

ALTER TABLE learning_review_cards
  DROP CONSTRAINT IF EXISTS learning_review_cards_status_check;
ALTER TABLE learning_review_cards
  DROP CONSTRAINT IF EXISTS ck_learning_review_cards_status;
ALTER TABLE learning_review_cards
  ADD CONSTRAINT ck_learning_review_cards_status
  CHECK (status IN ('learning', 'review', 'mastered', 'suspended'));

ALTER TABLE learning_review_cards
  DROP CONSTRAINT IF EXISTS ck_learning_review_cards_suspended_from;
ALTER TABLE learning_review_cards
  ADD CONSTRAINT ck_learning_review_cards_suspended_from
  CHECK (
    suspended_from_status IS NULL
    OR suspended_from_status IN ('learning', 'review', 'mastered')
  );

CREATE INDEX IF NOT EXISTS idx_learning_review_topic
  ON learning_review_cards(user_id, track_slug, stage_key, topic_key);
CREATE INDEX IF NOT EXISTS idx_learning_review_status_due
  ON learning_review_cards(user_id, status, due_at);

CREATE TABLE IF NOT EXISTS learning_review_events (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      text NOT NULL,
  action         text NOT NULL
                 CONSTRAINT ck_learning_review_events_action
                 CHECK (action IN ('snooze', 'pause', 'resume', 'complete')),
  question_keys  jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_count  int NOT NULL DEFAULT 0 CHECK (applied_count >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_review_events_user_created
  ON learning_review_events(user_id, created_at DESC);
