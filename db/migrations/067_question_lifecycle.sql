-- 067：题目生命周期（组二 · 阶段 12 剩余）
--
-- 背景：知识点有 `knowledge_points.status`，但**题目本身没有状态维度** ——
-- 内容包里的题一律视为已发布，无法表达「草稿 / 待审 / 已发布 / 已下线」。
-- 这里补一张 `learning_questions`：内容同步时按内容包 upsert（默认 published），
-- 之后可由内容团队把某道题置为 draft/review/archived（例如发现题干有误先下线），
-- 而**不物理删除**（历史作答 `learning_attempts` / 复习卡片仍引用 question_key）。
--
-- 幂等：ON CONFLICT (key) DO NOTHING；调用方是内容同步管线。
-- 回滚契约见 db/migrations/down/067_question_lifecycle.down.sql。

CREATE TABLE IF NOT EXISTS learning_questions (
  key             text PRIMARY KEY,            -- 内容包里的全局唯一 question_key
  track_slug      text NOT NULL,
  stage_key       text NOT NULL,
  topic_key       text,
  type            text NOT NULL
                  CONSTRAINT ck_learning_questions_type CHECK (type IN ('single','judge')),
  difficulty      text NOT NULL DEFAULT 'medium'
                  CONSTRAINT ck_learning_questions_difficulty CHECK (difficulty IN ('easy','medium','hard')),
  status          text NOT NULL DEFAULT 'published'
                  CONSTRAINT ck_learning_questions_status CHECK (status IN ('draft','review','published','archived')),
  source_key      text,
  content_version text NOT NULL DEFAULT 'unknown',
  fingerprint     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_questions_track ON learning_questions(track_slug, stage_key);
CREATE INDEX IF NOT EXISTS idx_learning_questions_status ON learning_questions(status);
CREATE INDEX IF NOT EXISTS idx_learning_questions_topic ON learning_questions(topic_key) WHERE topic_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_learning_questions_updated ON learning_questions;
CREATE TRIGGER trg_learning_questions_updated BEFORE UPDATE ON learning_questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
