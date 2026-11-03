-- 092: 408 套卷历史成绩（App 交卷后落库，Web/App 历史页共用）
--
-- 目标：把"套卷作答结果"持久化到用户维度 —— 总分、对错未答、用时、起止时间，
-- 以及按知识点 / 科目的错题分布（jsonb；结构由 apps/web/lib/exam-408-paper-attempts.ts
-- 的纯函数归一化后写入，读取时也过同一套归一化，脏条目直接丢弃）。
--
-- 口径：
--   - 只做追加型历史记录：一次交卷一条，不做软删、不做原地更新；
--   - 所有查询/写入按 user_id 过滤（数据隔离），user 删除时级联清理；
--   - paper_year 与 exam_408_papers.year 同口径（2000-2100），但**不建外键**：
--     历史成绩属于用户业务数据，不应因内容表重建/回滚而丢失。
--
-- 幂等：IF NOT EXISTS（生产只跑新迁移，可重复执行）。

CREATE TABLE IF NOT EXISTS exam_408_paper_attempts (
  id               bigserial PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_year       int NOT NULL
                   CONSTRAINT ck_exam_408_paper_attempts_year CHECK (paper_year BETWEEN 2000 AND 2100),
  score            int NOT NULL DEFAULT 0
                   CONSTRAINT ck_exam_408_paper_attempts_score CHECK (score >= 0),
  total_score      int NOT NULL DEFAULT 0
                   CONSTRAINT ck_exam_408_paper_attempts_total_score CHECK (total_score >= 0),
  correct          int NOT NULL DEFAULT 0
                   CONSTRAINT ck_exam_408_paper_attempts_correct CHECK (correct >= 0),
  wrong            int NOT NULL DEFAULT 0
                   CONSTRAINT ck_exam_408_paper_attempts_wrong CHECK (wrong >= 0),
  unanswered       int NOT NULL DEFAULT 0
                   CONSTRAINT ck_exam_408_paper_attempts_unanswered CHECK (unanswered >= 0),
  duration_seconds int
                   CONSTRAINT ck_exam_408_paper_attempts_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  started_at       timestamptz,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  by_point         jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_subject       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_408_paper_attempts_user_submitted
  ON exam_408_paper_attempts(user_id, submitted_at DESC);
