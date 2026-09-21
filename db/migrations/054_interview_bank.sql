-- 054：面试题库扩展（v12 P2-1）
-- 目的：支持「从公开题库抓取 → 落 COS → 同步入库」，并要求**保留来源**、可一键下架。
-- 幂等：ADD COLUMN IF NOT EXISTS + 部分唯一索引（external_key 为空的旧数据不受影响）。

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS tags        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_url  text,
  ADD COLUMN IF NOT EXISTS source_site text,
  ADD COLUMN IF NOT EXISTS license     text,
  ADD COLUMN IF NOT EXISTS external_key text,   -- 去重键：<source_site>#<sha1(question)>
  ADD COLUMN IF NOT EXISTS is_listed   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS crawled_at  timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_questions_external
  ON interview_questions(external_key) WHERE external_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interview_questions_listed
  ON interview_questions(module) WHERE is_listed = true;
