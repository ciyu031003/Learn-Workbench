-- 087: 408 交互演示（408card.top 98 个演示逐帧镜像）
-- steps: [{ explain: string, frame: string|null }]；frame 为 public/content-demos/<demo>/<n>.webp 的相对路径。
CREATE TABLE IF NOT EXISTS exam_408_demos (
  key                 text PRIMARY KEY,
  source_key          text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  subject_key         text NOT NULL,
  title               text NOT NULL,
  description         text NOT NULL DEFAULT '',
  knowledge_point_key text REFERENCES exam_408_knowledge_points(key) ON DELETE SET NULL,
  steps               jsonb NOT NULL DEFAULT '[]'::jsonb,
  frame_count         int NOT NULL DEFAULT 0 CHECK (frame_count >= 0),
  sort_order          int NOT NULL DEFAULT 0,
  fingerprint         text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'published'
                      CONSTRAINT ck_exam_408_demos_status
                      CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_408_demos_subject
  ON exam_408_demos(subject_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_408_demos_point
  ON exam_408_demos(knowledge_point_key) WHERE knowledge_point_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_exam_408_demos_updated ON exam_408_demos;
CREATE TRIGGER trg_exam_408_demos_updated
  BEFORE UPDATE ON exam_408_demos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
