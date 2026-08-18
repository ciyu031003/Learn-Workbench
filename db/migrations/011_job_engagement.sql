-- ============================================================================
-- 011：招花 2.0 —— 订阅提醒 + 考试日历 + 站内通知
--   1) job_subscriptions   每个账号的订阅（按 user_id 隔离）
--   2) job_notifications   订阅命中的站内通知（按 user_id 隔离）
--   3) job_exam_events     公告解析出的考试时间节点（全局，用于考试日历）
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_subscriptions (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  categories jsonb NOT NULL DEFAULT '[]',   -- 订阅的分类
  keywords   jsonb NOT NULL DEFAULT '[]',   -- 关键词（标题/公司/岗位表岗位名）
  cities     jsonb NOT NULL DEFAULT '[]',   -- 城市/地区
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_sub_user ON job_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS job_notifications (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  subscription_id bigint REFERENCES job_subscriptions(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text NOT NULL DEFAULT '',
  url             text NOT NULL DEFAULT '',
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_notif_user ON job_notifications(user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS job_exam_events (
  id         bigserial PRIMARY KEY,
  job_id     bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  source     text NOT NULL,
  kind       text NOT NULL,                 -- apply_start / apply_end / exam / interview / result
  label      text NOT NULL,                 -- 报名开始 / 报名截止 / 笔试 / 面试 / 成绩公布
  event_at   timestamptz NOT NULL,
  note       text NOT NULL DEFAULT '',
  UNIQUE (job_id, kind, event_at)
);

CREATE INDEX IF NOT EXISTS idx_exam_events ON job_exam_events(event_at);
CREATE INDEX IF NOT EXISTS idx_exam_job ON job_exam_events(job_id);
