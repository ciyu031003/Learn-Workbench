-- 060：统一内容模型与稳定 ID（组二 · 阶段 7 = V3 纵轨 Phase A，P0 红线）
--
-- 背景：仓库里并存两套内容模型 —— DB 路线图 `content_phases/content_topics`（职业路线 + 勾选进度）
-- 与 TS 学习库 `LearningTrack/Stage/Topic`（技术课程深内容）。本迁移**不做物理合并**，只做统一：
--   1) 路线图侧补齐与学习库同构的字段词汇（slug / status / difficulty / estimated_minutes / content_version …）；
--   2) 新建学习库侧的知识点索引表 + 三张关联表（题↔知识点、知识点前置、知识点关系）；
--   3) 建「作答记录统一视图」把 learning_attempts 与 interview_attempts 桥接起来（不搬数据）。
-- 决策依据与备选方案见 content-platform/adr/ADR-001-内容模型与稳定ID.md。
--
-- 红线遵守：只加结构、不动既有内容与学习记录（topic_progress / learning_attempts / learning_review_cards 原样保留）。
-- 幂等：ADD COLUMN IF NOT EXISTS + CREATE TABLE/INDEX IF NOT EXISTS + DO 块吞 duplicate_object；
--      db/schema.sql 已同步登记，全新库与既有库收敛到同一结构（scripts/check-schema-fresh.mjs 可验）。

-- ============================ 1) 路线图侧：字段词汇对齐 ============================

ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS estimated_minutes int NOT NULL DEFAULT 0;

-- 既有阶段回填稳定 slug（用已有的唯一 phase_key，不发明新 ID）
UPDATE content_phases SET slug = phase_key WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_phases_slug ON content_phases(slug);

ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS estimated_minutes int NOT NULL DEFAULT 0;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS content_version text NOT NULL DEFAULT 'unknown';
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS quality_level text NOT NULL DEFAULT 'L1';
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS content_updated_at timestamptz;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS stale_after timestamptz;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE content_topics SET slug = topic_key WHERE slug IS NULL;
UPDATE content_topics SET published_at = COALESCE(published_at, updated_at) WHERE published_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_topics_slug ON content_topics(slug);
CREATE INDEX IF NOT EXISTS idx_topics_status ON content_topics(status, sort_order);

-- slug 兜底触发器：外部写入（seed_content.sql 等）不带 slug 时自动取自己的稳定键，避免出现空 slug 行。
CREATE OR REPLACE FUNCTION content_topic_fill_slug() RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := NEW.topic_key;
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION content_phase_fill_slug() RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := NEW.phase_key;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_topics_fill_slug ON content_topics;
CREATE TRIGGER trg_content_topics_fill_slug BEFORE INSERT ON content_topics
  FOR EACH ROW EXECUTE FUNCTION content_topic_fill_slug();

DROP TRIGGER IF EXISTS trg_content_phases_fill_slug ON content_phases;
CREATE TRIGGER trg_content_phases_fill_slug BEFORE INSERT ON content_phases
  FOR EACH ROW EXECUTE FUNCTION content_phase_fill_slug();

-- 取值范围约束（命名，与 schema.sql 同名；已存在则跳过）
DO $$
BEGIN
  ALTER TABLE content_phases ADD CONSTRAINT ck_content_phases_status
    CHECK (status IN ('draft','review','published','archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_topics ADD CONSTRAINT ck_content_topics_status
    CHECK (status IN ('draft','review','published','archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_topics ADD CONSTRAINT ck_content_topics_quality
    CHECK (quality_level IN ('L0','L1','L2','L3','L4'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_topics ADD CONSTRAINT ck_content_topics_difficulty
    CHECK (difficulty IN ('easy','medium','hard'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================ 2) 学习库侧：知识点索引表 ============================

-- 知识点 = 学习库最小学习单元（内容正文仍在 packages/content，本表是它的**稳定 ID 索引 + 运营元数据**）。
CREATE TABLE IF NOT EXISTS knowledge_points (
  key                text PRIMARY KEY,              -- <trackSlug>/<stageKey>/<topicKey>，禁止用数组下标
  track_slug         text NOT NULL,
  stage_key          text NOT NULL,
  topic_key          text NOT NULL,
  track_title        text NOT NULL DEFAULT '',
  stage_title        text NOT NULL DEFAULT '',
  title              text NOT NULL,
  summary            text NOT NULL DEFAULT '',
  sort_order         int  NOT NULL DEFAULT 0,       -- 课程内全局顺序（跨阶段连续）
  stage_order        int  NOT NULL DEFAULT 0,
  topic_order        int  NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'published',
  quality_level      text NOT NULL DEFAULT 'L1',
  quality_missing    jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty         text NOT NULL DEFAULT 'medium',
  estimated_minutes  int  NOT NULL DEFAULT 5 CHECK (estimated_minutes >= 0),
  fingerprint        text NOT NULL DEFAULT '',      -- 内容指纹（导入去重 / 变更判定）
  content_version    text NOT NULL DEFAULT 'unknown',
  content_updated_at timestamptz,
  published_at       timestamptz,
  stale_after        timestamptz,                   -- 过期日期（Phase G 的时效提示依赖它）
  source_key         text,
  tags               jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_knowledge_points_status  CHECK (status IN ('draft','review','published','archived')),
  CONSTRAINT ck_knowledge_points_quality CHECK (quality_level IN ('L0','L1','L2','L3','L4')),
  CONSTRAINT ck_knowledge_points_level   CHECK (difficulty IN ('easy','medium','hard'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_points_track ON knowledge_points(track_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_stage ON knowledge_points(track_slug, stage_key, topic_order);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_status ON knowledge_points(status, quality_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_stale ON knowledge_points(stale_after) WHERE stale_after IS NOT NULL;

DROP TRIGGER IF EXISTS trg_knowledge_points_updated ON knowledge_points;
CREATE TRIGGER trg_knowledge_points_updated BEFORE UPDATE ON knowledge_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================ 3) 关联表（题↔知识点 / 前置 / 关系） ============================

CREATE TABLE IF NOT EXISTS question_knowledge_point (
  question_key        text NOT NULL,
  knowledge_point_key text NOT NULL REFERENCES knowledge_points(key) ON DELETE CASCADE,
  track_slug          text NOT NULL,
  stage_key           text NOT NULL,
  topic_key           text NOT NULL,
  link_source         text NOT NULL DEFAULT 'explicit',
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_key, knowledge_point_key),
  CONSTRAINT ck_qkp_link_source CHECK (link_source IN ('explicit','stage-fallback','curated'))
);

CREATE INDEX IF NOT EXISTS idx_qkp_point ON question_knowledge_point(knowledge_point_key);
CREATE INDEX IF NOT EXISTS idx_qkp_stage ON question_knowledge_point(track_slug, stage_key);

CREATE TABLE IF NOT EXISTS knowledge_prerequisite (
  knowledge_point_key text NOT NULL REFERENCES knowledge_points(key) ON DELETE CASCADE,
  prerequisite_key    text NOT NULL REFERENCES knowledge_points(key) ON DELETE CASCADE,
  relation_source     text NOT NULL DEFAULT 'derived',
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (knowledge_point_key, prerequisite_key),
  CONSTRAINT ck_knowledge_prereq_not_self CHECK (knowledge_point_key <> prerequisite_key),
  CONSTRAINT ck_knowledge_prereq_source   CHECK (relation_source IN ('derived','curated'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_prereq_of ON knowledge_prerequisite(prerequisite_key);

CREATE TABLE IF NOT EXISTS knowledge_relation (
  from_key        text NOT NULL REFERENCES knowledge_points(key) ON DELETE CASCADE,
  to_key          text NOT NULL REFERENCES knowledge_points(key) ON DELETE CASCADE,
  kind            text NOT NULL,
  relation_source text NOT NULL DEFAULT 'derived',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_key, to_key, kind),
  CONSTRAINT ck_knowledge_relation_kind   CHECK (kind IN ('next','related')),
  CONSTRAINT ck_knowledge_relation_source CHECK (relation_source IN ('derived','curated')),
  CONSTRAINT ck_knowledge_relation_not_self CHECK (from_key <> to_key)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_relation_to ON knowledge_relation(to_key, kind);

-- ============================ 4) 作答记录统一视图（桥，不搬数据） ============================

-- 两套作答（学习库 learning_attempts / 职业面试 interview_attempts）字段不同，直接合并会丢语义；
-- 用视图给出**最小公共口径**（谁、何时、对错、属于哪个领域），需要细节再回原表。
CREATE OR REPLACE VIEW learning_attempts_unified AS
  SELECT
    'library'::text      AS domain,
    la.user_id,
    la.track_slug,
    la.stage_key,
    la.question_key,
    la.is_correct,
    la.created_at
  FROM learning_attempts la
  UNION ALL
  SELECT
    ('interview:' || ia.mode)::text AS domain,
    ia.user_id,
    NULL::text           AS track_slug,
    NULL::text           AS stage_key,
    ('interview:' || ia.question_id::text) AS question_key,
    ia.is_correct,
    ia.created_at
  FROM interview_attempts ia
  WHERE ia.question_id IS NOT NULL;
