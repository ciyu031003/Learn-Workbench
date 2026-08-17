-- ============================================================================
-- 007：招花 · 招聘信息爬虫
--   1) job_crawler_configs  每个账号一份爬虫配置（按 user_id 隔离）
--   2) job_postings         全局职位库（爬虫写入，多账号共享只读）
--   3) job_favorites        每个账号的收藏职位（按 user_id 隔离）
--   4) job_crawler_runs     爬虫运行日志（全局）
-- ============================================================================

-- ---------- 1. 账号爬虫配置（每用户一行） ----------
CREATE TABLE IF NOT EXISTS job_crawler_configs (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  keywords      jsonb NOT NULL DEFAULT '[]',
  industries    jsonb NOT NULL DEFAULT '[]',
  cities        jsonb NOT NULL DEFAULT '[]',
  platforms     jsonb NOT NULL DEFAULT '["lagou","liepin","zhilian","job51"]',
  schedule_time text   NOT NULL DEFAULT '08:00',
  enabled       boolean NOT NULL DEFAULT true,
  max_pages     int    NOT NULL DEFAULT 3,
  last_run_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. 职位库（爬虫写入，全局共享） ----------
CREATE TABLE IF NOT EXISTS job_postings (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL,          -- lagou / liepin / zhilian / job51 / boss
  source_job_id text NOT NULL,          -- 源站职位 ID
  title         text NOT NULL,
  company       text NOT NULL DEFAULT '',
  city          text NOT NULL DEFAULT '',
  district      text NOT NULL DEFAULT '',
  salary_min    int,
  salary_max    int,
  salary_text   text NOT NULL DEFAULT '',
  experience    text NOT NULL DEFAULT '',
  education     text NOT NULL DEFAULT '',
  tags          jsonb NOT NULL DEFAULT '[]',
  description   text NOT NULL DEFAULT '',
  requirements  text NOT NULL DEFAULT '',
  company_info  text NOT NULL DEFAULT '',
  url           text NOT NULL,
  logo_url      text NOT NULL DEFAULT '',
  published_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (source, source_job_id)
);

-- ---------- 3. 账号收藏职位 ----------
CREATE TABLE IF NOT EXISTS job_favorites (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

-- ---------- 4. 爬虫运行日志（全局） ----------
CREATE TABLE IF NOT EXISTS job_crawler_runs (
  id               bigserial PRIMARY KEY,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  status           text NOT NULL DEFAULT 'running',   -- running / success / partial / failed
  config_snapshot  jsonb,
  platforms_result jsonb NOT NULL DEFAULT '{}',
  fetched_count    int NOT NULL DEFAULT 0,
  new_count        int NOT NULL DEFAULT 0,
  error            text
);

-- ---------- 索引 ----------
CREATE INDEX IF NOT EXISTS idx_jobs_source   ON job_postings(source);
CREATE INDEX IF NOT EXISTS idx_jobs_city     ON job_postings(city);
CREATE INDEX IF NOT EXISTS idx_jobs_title    ON job_postings(title);
CREATE INDEX IF NOT EXISTS idx_jobs_fetched  ON job_postings(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_salary   ON job_postings(salary_max DESC);
CREATE INDEX IF NOT EXISTS idx_fav_job       ON job_favorites(job_id);
CREATE INDEX IF NOT EXISTS idx_runs_started  ON job_crawler_runs(started_at DESC);

-- ---------- 触发器：config 的 updated_at ----------
DROP TRIGGER IF EXISTS trg_job_crawler_configs_updated ON job_crawler_configs;
CREATE TRIGGER trg_job_crawler_configs_updated
  BEFORE UPDATE ON job_crawler_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
