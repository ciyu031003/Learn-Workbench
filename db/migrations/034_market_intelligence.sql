-- ============================================================================
-- 034: Market Intelligence
--   1) job_postings enrichment columns for fast filtered market aggregation
--   2) market_dimension_snapshots for daily dimension-level time series
--   3) market_saved_views for user-saved market filter views
-- ============================================================================

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS function_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_family text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seniority_bucket text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS industry_sector text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS industry_subsector text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS salary_band text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS market_enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_jobs_market_function
  ON job_postings(function_key)
  WHERE function_key <> '';

CREATE INDEX IF NOT EXISTS idx_jobs_market_industry
  ON job_postings(industry_sector, industry_subsector)
  WHERE industry_sector <> '';

CREATE INDEX IF NOT EXISTS idx_jobs_market_seniority
  ON job_postings(seniority_bucket)
  WHERE seniority_bucket <> '';

CREATE INDEX IF NOT EXISTS idx_jobs_market_band
  ON job_postings(salary_band)
  WHERE salary_band <> '';

CREATE TABLE IF NOT EXISTS market_dimension_snapshots (
  id            bigserial PRIMARY KEY,
  snap_date      date NOT NULL,
  dimension      text NOT NULL,
  dimension_key  text NOT NULL,
  metric_name    text NOT NULL,
  metric_value   numeric NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snap_date, dimension, dimension_key, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_market_dimension_snapshot_lookup
  ON market_dimension_snapshots(snap_date DESC, dimension, dimension_key);

CREATE TABLE IF NOT EXISTS market_saved_views (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  filters    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_market_saved_views_user
  ON market_saved_views(user_id, updated_at DESC);
