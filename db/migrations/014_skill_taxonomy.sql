-- ============================================================================
-- 014：招花 P2 —— 技能体系：技能库 + 用户技能 + 岗位技能 + 技能↔学习内容映射
--   1) skill_taxonomy     技能库（规范名 + 别名 + 分类）
--   2) user_skills        用户技能画像（resume_assets 回填 + 手动维护）
--   3) job_skill_links    岗位技能画像（job_postings.tags 归一化后回填）
--   4) skill_content_links 技能 ↔ 学习主题映射（能力缺口 → 学习路线）
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_taxonomy (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL UNIQUE,           -- 规范名，如 redis
  aliases    jsonb NOT NULL DEFAULT '[]',    -- 别名（归一化匹配用）
  category   text NOT NULL DEFAULT '',       -- backend/frontend/ops/ai/data/network/security/cloud/soft
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id   bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  level      int NOT NULL DEFAULT 2,         -- 0-5（0=不会 1=了解 2=入门 3=熟练 4=精通 5=专家）
  source     text NOT NULL DEFAULT 'manual', -- manual / resume / topic / gap
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS job_skill_links (
  job_id   bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  weight   numeric(3,2) NOT NULL DEFAULT 1,  -- 岗位对该技能的权重（默认 1）
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS skill_content_links (
  skill_id       bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  topic_id       bigint NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  estimate_hours int NOT NULL DEFAULT 8,     -- 预计学习时长（小时）
  PRIMARY KEY (skill_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_job_skill_job   ON job_skill_links(job_id);
CREATE INDEX IF NOT EXISTS idx_skill_content_skill ON skill_content_links(skill_id);
