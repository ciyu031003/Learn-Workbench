-- 048：MD 导入的三级学习内容（v6 P3-2）
-- 结构：H1 → content_phases（阶段）/ H2 → content_topics（主题）/ H3 → content_topic_items（学习内容条目）
-- 全部导入实体带 is_custom=TRUE + owner_id + import_batch_id，与内置内容隔离、可按批次追溯。

CREATE TABLE IF NOT EXISTS content_topic_items (
  id         bigserial PRIMARY KEY,
  topic_id   int NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_items_topic ON content_topic_items(topic_id, sort_order);

DROP TRIGGER IF EXISTS trg_topic_items_updated ON content_topic_items;
CREATE TRIGGER trg_topic_items_updated BEFORE UPDATE ON content_topic_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 导入批次标记（幂等/追溯/整批回滚；NULL = 非导入内容）
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS import_batch_id text;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS import_batch_id text;
CREATE INDEX IF NOT EXISTS idx_content_phases_batch ON content_phases(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_topics_batch ON content_topics(import_batch_id) WHERE import_batch_id IS NOT NULL;
