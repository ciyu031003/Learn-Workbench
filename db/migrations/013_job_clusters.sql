-- ============================================================================
-- 013：招花 P1 —— 职位去重聚类（job_clusters）
--   多平台可能发布同一职位（BOSS/猎聘/智联/官网…），按规范化后的
--   canonical_title + canonical_company + city 聚合成簇，避免用户看到重复职位。
--   去重时机：爬虫写库后触发聚类任务（增量，不阻塞抓取）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_clusters (
  id               bigserial PRIMARY KEY,
  canonical_title  text NOT NULL,           -- 规范化职位名
  canonical_company text NOT NULL,          -- 规范化公司名
  city             text NOT NULL DEFAULT '',-- 城市
  dedup_key        text NOT NULL,           -- normalize(title)|normalize(company)|city（唯一键）
  job_ids          bigint[] NOT NULL DEFAULT '{}',   -- 簇内成员职位 id
  source_list      jsonb NOT NULL DEFAULT '[]',      -- 发现来源（如 ["boss","liepin","zhilian"]）
  primary_job_id   bigint,                  -- 代表职位（最新抓取的一个）
  member_count     int NOT NULL DEFAULT 1,  -- 簇内职位数
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_job_clusters_dedup ON job_clusters(dedup_key);
CREATE INDEX IF NOT EXISTS idx_job_clusters_member ON job_clusters USING GIN (job_ids);
