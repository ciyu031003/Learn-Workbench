-- ============================================================================
-- 010：招花 2.0 —— 职位库分类扩展 + 爬虫配置扩展
--   1) job_postings 增加 category / channel / deadline_at / extra
--   2) job_crawler_configs 增加 categories / provinces / sources（按 user 隔离）
--   3) job_crawler_runs 增加 sources_result（按源汇总）
-- ============================================================================

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'internet',  -- 业务分类
  ADD COLUMN IF NOT EXISTS channel  text NOT NULL DEFAULT 'job',       -- job / announcement / event
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,                    -- 公告报名截止
  ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';          -- 招录人数/岗位表/考试时间等

CREATE INDEX IF NOT EXISTS idx_jobs_category  ON job_postings(category, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON job_postings(deadline_at);
CREATE INDEX IF NOT EXISTS idx_jobs_channel  ON job_postings(channel);

ALTER TABLE job_crawler_configs
  ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '["internet","gongkao","gongbian","yangqi"]',
  ADD COLUMN IF NOT EXISTS provinces  jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sources    jsonb NOT NULL DEFAULT '[]';     -- 空 = 全部启用源

ALTER TABLE job_crawler_runs
  ADD COLUMN IF NOT EXISTS sources_result jsonb NOT NULL DEFAULT '{}';
