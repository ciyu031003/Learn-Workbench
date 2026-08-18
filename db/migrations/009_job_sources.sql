-- ============================================================================
-- 009：招花 2.0 —— hosts 信息源注册表 + 健康度
--   1) job_crawler_sources  信息源注册表（hosts 定位文件落库，爬虫按此抓取）
--   2) job_source_health    每个源的每次抓取健康记录（命中率历史，用于可视化）
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_crawler_sources (
  id               text PRIMARY KEY,          -- 与 hosts 文件 id 一致
  category         text NOT NULL,             -- internet / gongkao / gongbian / yangqi
  channel          text NOT NULL DEFAULT 'announcement', -- job / announcement / event
  name             text NOT NULL,
  engine           text NOT NULL DEFAULT 'http',  -- http / browser
  base_url         text NOT NULL DEFAULT '',
  list_config      jsonb NOT NULL DEFAULT '{}',   -- list/pagination/selectors
  detail_config    jsonb NOT NULL DEFAULT '{}',
  deadline_parse   boolean NOT NULL DEFAULT false,
  rate_limit_ms    int NOT NULL DEFAULT 3000,
  max_items_per_run int NOT NULL DEFAULT 20,
  max_pages        int NOT NULL DEFAULT 1,
  risk             text NOT NULL DEFAULT 'L1',
  enabled          boolean NOT NULL DEFAULT true,
  hit_rate         numeric(4,3) NOT NULL DEFAULT 1,
  last_run_at      timestamptz,
  last_error       text NOT NULL DEFAULT '',
  note             text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_sources_category ON job_crawler_sources(category);
CREATE INDEX IF NOT EXISTS idx_job_sources_enabled  ON job_crawler_sources(enabled);

CREATE TABLE IF NOT EXISTS job_source_health (
  id         bigserial PRIMARY KEY,
  source     text NOT NULL REFERENCES job_crawler_sources(id) ON DELETE CASCADE,
  run_id     bigint,
  fetched    int NOT NULL DEFAULT 0,
  hit_rate   numeric(4,3) NOT NULL DEFAULT 0,
  error      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_health ON job_source_health(source, created_at DESC);

-- ---------- 触发器：job_crawler_sources 的 updated_at ----------
DROP TRIGGER IF EXISTS trg_job_crawler_sources_updated ON job_crawler_sources;
CREATE TRIGGER trg_job_crawler_sources_updated
  BEFORE UPDATE ON job_crawler_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
