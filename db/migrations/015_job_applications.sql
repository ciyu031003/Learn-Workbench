-- ============================================================================
-- 015：招花 P3 —— 求职管理（job_applications）
--   收藏 → 准备投递 → 已投递 → 笔试 → 一面 → 二面 → Offer → 入职 全流程记录
--   按 user_id 隔离；与 job_favorites 并存（收藏=快存，求职=管道）
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_applications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  stage      text NOT NULL DEFAULT 'favorite'
             CHECK (stage IN ('favorite','ready','applied','online_test','interview1','interview2','offer','hired','closed')),
  note       text NOT NULL DEFAULT '',
  applied_at timestamptz,                       -- 投递时间
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_app_user ON job_applications(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_job_app_job ON job_applications(job_id);
