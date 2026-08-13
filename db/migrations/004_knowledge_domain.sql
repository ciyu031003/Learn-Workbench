-- ============================================================================
-- 004：Knowledge Domain（方案 §11-§18）
-- 学习知识库：KnowledgeNote / KnowledgeTag / KnowledgeNoteTag / KnowledgeLink
-- user_id 为 NULL 表示本地匿名（与其他表一致）；登录用户数据按 user 隔离。
-- 说明：type/status 枚举与方案 §12 一致；knowledge_links 用于建立知识间关系（RELATED/PREREQUISITE/REFERENCE/DERIVED）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  topic_id     int REFERENCES content_topics(id) ON DELETE SET NULL,
  title        text NOT NULL,
  slug         text NOT NULL,
  content      text NOT NULL,
  summary      text,
  type         text NOT NULL DEFAULT 'NOTE'
               CHECK (type IN ('NOTE','TUTORIAL','REFERENCE','MINDMAP','REVIEW','PROJECT_NOTE')),
  status       text NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  source       text,           -- 来源标识（travel-notes / manual / ...）
  source_path  text,           -- 原始来源路径
  source_id    text,           -- 原始来源 ID（可追溯）
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_notes_user ON knowledge_notes(user_id, slug) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_notes_anon ON knowledge_notes(slug) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_type  ON knowledge_notes(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_topic ON knowledge_notes(topic_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_user  ON knowledge_notes(user_id);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_tags_user ON knowledge_tags(user_id, slug) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_tags_anon ON knowledge_tags(slug) WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_note_tags (
  note_id bigint NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  tag_id  bigint NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS knowledge_links (
  id             bigserial PRIMARY KEY,
  source_note_id bigint NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  target_note_id bigint NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  type           text NOT NULL DEFAULT 'RELATED'
                 CHECK (type IN ('RELATED','PREREQUISITE','REFERENCE','DERIVED')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (source_note_id <> target_note_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_links_source ON knowledge_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_target ON knowledge_links(target_note_id);

DROP TRIGGER IF EXISTS trg_knowledge_notes_updated ON knowledge_notes;
CREATE TRIGGER trg_knowledge_notes_updated
  BEFORE UPDATE ON knowledge_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
