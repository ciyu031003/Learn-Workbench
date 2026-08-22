-- ============================================================================
-- 017_market_stats.sql —— P1 市场分析物化缓存（幂等，可重复执行）
--  1) job_postings.tags GIN 索引（tags ?| / jsonb 查询加速）
--  2) market_stats 结果缓存表（多实例共享，60s TTL 由应用层控制）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_postings_tags_gin
  ON job_postings USING GIN (tags);

CREATE TABLE IF NOT EXISTS market_stats (
  key         text PRIMARY KEY,
  payload     jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);