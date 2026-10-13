-- 074: FSRS 影子双跑与可回退调度开关（V3 Phase 5）
--
-- 关键约束：
--   1. due_at 仍由 sm2-lwb-v2 维护，FSRS 只写影子字段；
--   2. 迁移不重算历史卡，历史评估通过作答回放实时生成；
--   3. 用户/课程可关闭影子计算，一键回到纯 SM-2；
--   4. 影子状态保留 ts-fsrs Card 的完整 JSON，便于后续原地迁移。
--
-- 回滚契约见 db/migrations/down/074_fsrs_shadow.down.sql。

ALTER TABLE learning_review_cards
  ADD COLUMN IF NOT EXISTS fsrs_state jsonb,
  ADD COLUMN IF NOT EXISTS fsrs_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS fsrs_stability numeric(12,4),
  ADD COLUMN IF NOT EXISTS fsrs_difficulty numeric(12,4),
  ADD COLUMN IF NOT EXISTS fsrs_last_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS fsrs_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_learning_review_fsrs_due
  ON learning_review_cards(user_id, fsrs_due_at)
  WHERE fsrs_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS learning_scheduler_settings (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_slug   text NOT NULL DEFAULT '*',
  mode         text NOT NULL DEFAULT 'shadow'
               CONSTRAINT ck_learning_scheduler_settings_mode
               CHECK (mode IN ('off', 'shadow')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_slug)
);

CREATE INDEX IF NOT EXISTS idx_learning_scheduler_settings_mode
  ON learning_scheduler_settings(mode);

DROP TRIGGER IF EXISTS trg_learning_scheduler_settings_updated ON learning_scheduler_settings;
CREATE TRIGGER trg_learning_scheduler_settings_updated
  BEFORE UPDATE ON learning_scheduler_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
