-- ============================================================================
-- 016_security_hardening.sql —— P0 安全加固（幂等，可重复执行）
--  1) users.is_admin：受限操作（爬虫触发/hosts 更新）管理员鉴权
--  2) auth_attempts：登录失败计数（防爆破）
--  3) task_runs：后台任务互斥锁（防重复触发爬虫/脚本）
--  4) 匿名数据设备作用域：anon_id 列 + 部分唯一索引（认领/读取按设备隔离）
-- ============================================================================

-- ---------- 1. 管理员标记 ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ---------- 2. 登录失败审计 ----------
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         bigserial PRIMARY KEY,
  username   text NOT NULL DEFAULT '',
  ip         text NOT NULL DEFAULT '',
  success    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup
  ON auth_attempts (username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip
  ON auth_attempts (ip, created_at DESC);

-- ---------- 3. 后台任务互斥锁 ----------
CREATE TABLE IF NOT EXISTS task_runs (
  id          bigserial PRIMARY KEY,
  task_key    text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'idle'
              CHECK (status IN ('idle','running','finished','failed')),
  started_by  text,
  pid         int,
  started_at  timestamptz,
  finished_at timestamptz,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 4. 匿名数据设备作用域（anon_id） ----------
ALTER TABLE topic_progress  ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE daily_tasks     ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE focus_sessions  ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE checkins        ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE log_entries     ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE certificates    ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE xp_events       ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE resume_assets   ADD COLUMN IF NOT EXISTS anon_id text;

-- 匿名行去重（登录用户走既有 (user_id, ...) 唯一约束，二者互斥）
CREATE UNIQUE INDEX IF NOT EXISTS uq_topic_progress_anon
  ON topic_progress (anon_id, topic_id) WHERE anon_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_anon
  ON checkins (anon_id, checkin_date) WHERE anon_id IS NOT NULL;
-- 健康/知识域匿名数据设备作用域（与主用户数据一致）
ALTER TABLE break_sessions      ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE energy_logs         ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE hydration_logs      ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE hydration_goals     ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE wellbeing_reminders ADD COLUMN IF NOT EXISTS anon_id text;
ALTER TABLE knowledge_notes     ADD COLUMN IF NOT EXISTS anon_id text;