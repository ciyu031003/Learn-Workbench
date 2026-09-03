-- ============================================================================
-- 027：领域记录维度（通用计量模型，P3）
-- 一套覆盖英语单词量 / 羽毛球训练量 / 跑量 / 体重等的通用计数：
-- domain_trackers（计量项）+ tracker_logs（按日期记录）
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_trackers (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  domain_key    text NOT NULL DEFAULT 'ict',
  name          text NOT NULL,
  unit          text NOT NULL DEFAULT '',
  target_value  numeric,
  target_cadence text CHECK (target_cadence IN ('daily','weekly')),
  color         text NOT NULL DEFAULT '#6366f1',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  client_id     text,
  UNIQUE (user_id, domain_key, name)
);

CREATE INDEX IF NOT EXISTS idx_domain_trackers_domain ON domain_trackers(domain_key);
CREATE INDEX IF NOT EXISTS idx_domain_trackers_user   ON domain_trackers(user_id);

CREATE TABLE IF NOT EXISTS tracker_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  tracker_id bigint REFERENCES domain_trackers(id) ON DELETE CASCADE,
  log_date   date NOT NULL,
  value      numeric NOT NULL DEFAULT 0,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tracker_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_tracker_logs_tracker ON tracker_logs(tracker_id);
CREATE INDEX IF NOT EXISTS idx_tracker_logs_user    ON tracker_logs(user_id);
