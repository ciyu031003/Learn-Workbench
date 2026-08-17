-- ============================================================================
-- 008：招花爬虫调优 —— job_postings 增加 content_hash
-- 内容哈希：爬虫据此判断职位内容是否变化，未变化则跳过 UPDATE，减少写放大
-- ============================================================================

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_jobs_content_hash ON job_postings(source, content_hash);
