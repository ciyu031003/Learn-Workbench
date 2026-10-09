-- 058: 技术题库练习记录与复习卡片
-- 内容主体保存在 packages/content，数据库只保存用户作答和复习状态。

CREATE TABLE IF NOT EXISTS learning_attempts (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_slug     text NOT NULL,
  stage_key      text NOT NULL,
  question_key   text NOT NULL,
  chosen_answer  jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_correct     boolean NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_created
  ON learning_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_question
  ON learning_attempts(user_id, question_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_track
  ON learning_attempts(user_id, track_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_review_cards (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key   text NOT NULL,
  track_slug     text NOT NULL,
  stage_key      text NOT NULL,
  status         text NOT NULL DEFAULT 'learning'
                 CHECK (status IN ('learning', 'review', 'mastered')),
  interval_days  int NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  ease           numeric(4,2) NOT NULL DEFAULT 2.50 CHECK (ease >= 1.30 AND ease <= 3.50),
  streak         int NOT NULL DEFAULT 0 CHECK (streak >= 0),
  lapses         int NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  due_at         timestamptz NOT NULL DEFAULT now(),
  last_result    boolean,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_learning_review_due
  ON learning_review_cards(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_learning_review_track
  ON learning_review_cards(user_id, track_slug);

DROP TRIGGER IF EXISTS trg_learning_review_cards_updated ON learning_review_cards;
CREATE TRIGGER trg_learning_review_cards_updated BEFORE UPDATE ON learning_review_cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

