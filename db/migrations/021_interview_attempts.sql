-- ============================================================================
-- 021：P3 面试题库与模拟面试 —— 答题/面试记录（interview_attempts）
--   mode：quiz 题库刷题 | mock 模拟面试 | interview 真实面试记录
--   按 user_id 隔离；interview_questions 为共享题库（无 user_id，不在本表）
--   application_id 可绑定求职管道某一场 interview（关联 job_applications，P3-4）
--   phase_id 可关联路线图阶段（用于「刷题薄弱 → 市场缺口 → 学习路线」）
-- ============================================================================

CREATE TABLE IF NOT EXISTS interview_attempts (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id    bigint REFERENCES interview_questions(id) ON DELETE SET NULL,
  application_id bigint REFERENCES job_applications(id) ON DELETE SET NULL,
  phase_id       int REFERENCES content_phases(id) ON DELETE SET NULL,
  mode           text NOT NULL DEFAULT 'quiz'
                 CHECK (mode IN ('quiz','mock','interview')),
  self_rating    int CHECK (self_rating IS NULL OR (self_rating >= 1 AND self_rating <= 5)),
  reaction       int,                              -- 答题用时（秒）
  chosen_answer  text NOT NULL DEFAULT '',         -- 用户作答
  is_correct     boolean,                          -- 刷题时对错；自由模拟/真实面试为 NULL
  note           text NOT NULL DEFAULT '',         -- 复盘/结论/待改进点
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_attempt_user ON interview_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempt_question ON interview_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempt_application ON interview_attempts(application_id);
