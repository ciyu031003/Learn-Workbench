-- 075：学习内容全量入库（内容包 → 数据库；App 前台只做读取 + 模板）
--
-- 背景（2026-10-14 用户决策）：技术题库与知识点此前只在 packages/content 里（编译进 Web 包），
-- 改一个知识点/加一道题必须改代码并重新部署，运营与内容维护成本高。现改为：
--   packages/content 继续作为**编辑与测试门禁的来源**，但其内容整体同步进库；
--   运行时（Web / App）只读数据库，用模板渲染。
--
-- 设计要点：
--   1. 内容权威链：内容包 → 本迁移的表（一次性/增量同步）→ 运行时读取；
--   2. 复用既有生命周期：learning_questions 已有 status(draft/review/published/archived)，
--      这里只**补内容列**（stem/options/answer/explanation/tags/level），不另立题目表，
--      这样"下架一道题"仍然是同一条记录的状态流转；
--   3. 幂等：同步按稳定主键 upsert；本迁移全部 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行；
--   4. 内容指纹 fingerprint + content_version 用于判定"变没变"，避免无谓写库。
--
-- 回滚契约见 db/migrations/down/075_learning_content.down.sql。

-- ---------- 课程 ----------
CREATE TABLE IF NOT EXISTS learning_tracks (
  slug            text PRIMARY KEY,
  title           text NOT NULL,
  category        text NOT NULL,
  level           text NOT NULL DEFAULT '综合',
  accent          text NOT NULL DEFAULT '',
  soft_accent     text NOT NULL DEFAULT '',
  icon            text NOT NULL DEFAULT '',
  summary         text NOT NULL DEFAULT '',
  why_learn       text NOT NULL DEFAULT '',
  prerequisites   jsonb NOT NULL DEFAULT '[]'::jsonb,
  study_method    jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_hours int NOT NULL DEFAULT 0,
  featured        boolean NOT NULL DEFAULT false,
  sort_order      int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'published'
                  CONSTRAINT ck_learning_tracks_status CHECK (status IN ('draft','review','published','archived')),
  content_version text NOT NULL DEFAULT 'unknown',
  fingerprint     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- 阶段 ----------
CREATE TABLE IF NOT EXISTS learning_stages (
  track_slug  text NOT NULL REFERENCES learning_tracks(slug) ON DELETE CASCADE,
  key         text NOT NULL,
  title       text NOT NULL,
  weeks       text NOT NULL DEFAULT '',
  goal        text NOT NULL DEFAULT '',
  outcome     text NOT NULL DEFAULT '',
  lesson      jsonb,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_slug, key)
);

-- ---------- 知识点 ----------
CREATE TABLE IF NOT EXISTS learning_topics (
  track_slug   text NOT NULL REFERENCES learning_tracks(slug) ON DELETE CASCADE,
  key          text NOT NULL,
  stage_key    text NOT NULL,
  title        text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  concepts     jsonb NOT NULL DEFAULT '[]'::jsonb,
  principles   jsonb NOT NULL DEFAULT '[]'::jsonb,
  applications jsonb NOT NULL DEFAULT '[]'::jsonb,
  pitfalls     jsonb NOT NULL DEFAULT '[]'::jsonb,
  method       text NOT NULL DEFAULT '',
  exercise     text NOT NULL DEFAULT '',
  checkpoint   text NOT NULL DEFAULT '',
  lesson       jsonb,
  animations   jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order   int NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'published'
               CONSTRAINT ck_learning_topics_status CHECK (status IN ('draft','review','published','archived')),
  fingerprint  text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_slug, key),
  CONSTRAINT fk_learning_topics_stage FOREIGN KEY (track_slug, stage_key)
    REFERENCES learning_stages(track_slug, key) ON DELETE CASCADE
);

-- ---------- 来源 ----------
CREATE TABLE IF NOT EXISTS learning_sources (
  track_slug text NOT NULL REFERENCES learning_tracks(slug) ON DELETE CASCADE,
  key        text NOT NULL,
  name       text NOT NULL,
  url        text NOT NULL DEFAULT '',
  license    text NOT NULL DEFAULT '',
  usage      text NOT NULL DEFAULT 'reference'
             CONSTRAINT ck_learning_sources_usage CHECK (usage IN ('import','reference')),
  note       text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (track_slug, key)
);

-- ---------- 算法演示动图 ----------
CREATE TABLE IF NOT EXISTS learning_animations (
  key        text PRIMARY KEY,
  frames     jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 题目内容列（生命周期沿用 learning_questions.status） ----------
ALTER TABLE learning_questions
  ADD COLUMN IF NOT EXISTS stem        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS options     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS answer      jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS level       text,
  ADD COLUMN IF NOT EXISTS sort_order  int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_learning_tracks_sort ON learning_tracks(sort_order, slug);
CREATE INDEX IF NOT EXISTS idx_learning_stages_track ON learning_stages(track_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_topics_track ON learning_topics(track_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_topics_stage ON learning_topics(track_slug, stage_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_questions_level ON learning_questions(level);
CREATE INDEX IF NOT EXISTS idx_learning_questions_track_order ON learning_questions(track_slug, sort_order);

DROP TRIGGER IF EXISTS trg_learning_tracks_updated ON learning_tracks;
CREATE TRIGGER trg_learning_tracks_updated BEFORE UPDATE ON learning_tracks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_learning_stages_updated ON learning_stages;
CREATE TRIGGER trg_learning_stages_updated BEFORE UPDATE ON learning_stages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_learning_topics_updated ON learning_topics;
CREATE TRIGGER trg_learning_topics_updated BEFORE UPDATE ON learning_topics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
