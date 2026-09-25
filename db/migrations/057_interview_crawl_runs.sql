-- 057：面试题库每日爬虫运行记录（v1.26）
-- 目的：让「每天定时爬面试题」具备与岗位爬虫同款的**运行记录 + 幂等守卫**能力。
--   - 岗位爬虫用 job_crawler_runs；面试题库是另一条来源线，单独一张表，避免互相干扰；
--   - status 取值与岗位爬虫一致：running / success / partial / failed（踩坑 28：守卫依赖状态字符串）；
--   - 幂等守卫 = 当天是否已有 status='success' 的行（见 apps/web/lib/tasks/interview.ts）。
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS，可重复执行。

CREATE TABLE IF NOT EXISTS interview_crawl_runs (
  id            bigserial PRIMARY KEY,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running',   -- running / success / partial / failed
  started_by    text NOT NULL DEFAULT 'cron',      -- cron / admin / manual
  fetched_count int NOT NULL DEFAULT 0,            -- 解析出的题目数
  imported_count int NOT NULL DEFAULT 0,           -- 落库（新增 + 更新）条数
  skipped_count int NOT NULL DEFAULT 0,            -- 判重跳过条数
  sources_result jsonb NOT NULL DEFAULT '{}',      -- 按来源汇总（沿用岗位爬虫的字段名）
  error         text
);

CREATE INDEX IF NOT EXISTS idx_interview_runs_started ON interview_crawl_runs(started_at DESC);
