-- 088: 408 章节知识图谱（cs408 精读 iframe 数据原生入库，双端自绘）
CREATE TABLE IF NOT EXISTS exam_408_knowledge_maps (
  key         text PRIMARY KEY,              -- '<subject_key>:<章节名>'
  topic_key   text REFERENCES exam_408_study_topics(key) ON DELETE SET NULL,
  source_key  text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  subject_key text NOT NULL,
  chapter     text NOT NULL,
  map         jsonb NOT NULL DEFAULT '{"nodes":[]}'::jsonb,
  node_count  int NOT NULL DEFAULT 0 CHECK (node_count >= 0),
  fingerprint text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_key, chapter)
);

CREATE INDEX IF NOT EXISTS idx_exam_408_maps_subject
  ON exam_408_knowledge_maps(subject_key, chapter);
CREATE INDEX IF NOT EXISTS idx_exam_408_maps_topic
  ON exam_408_knowledge_maps(topic_key) WHERE topic_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_exam_408_maps_updated ON exam_408_knowledge_maps;
CREATE TRIGGER trg_exam_408_maps_updated
  BEFORE UPDATE ON exam_408_knowledge_maps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
