-- 085: 408 精读正文（cs408.cloud）与来源登记
-- 授权：作者已同意「个人学习、非商用」，保留署名与原文链接。来源快照与正文一并入库。
INSERT INTO exam_408_source_snapshots (key, name, base_url, license_note, usage_scope, note)
VALUES
  ('cs408-cloud', '408 知识库 · 知识精读', 'https://cs408.cloud/',
   '作者已同意个人学习、非商业用途；保留署名与原文链接，不再分发。', 'personal-study',
   '181 个知识主题（Markdown 正文）与 840 张 SVG 插图快照。'),
  ('408card-top', '408 知识点速过 · 速记卡与演示', 'https://408card.top/',
   '作者已同意个人学习、非商业用途；保留署名与来源链接。', 'personal-study',
   '529 张速记卡（四科）与 98 个交互演示的逐帧镜像。')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  license_note = EXCLUDED.license_note,
  usage_scope = EXCLUDED.usage_scope,
  note = EXCLUDED.note,
  updated_at = now();

CREATE TABLE IF NOT EXISTS exam_408_study_topics (
  key                 text PRIMARY KEY,
  source_key          text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  subject_key         text NOT NULL,
  chapter             text NOT NULL,
  chapter_order       int NOT NULL DEFAULT 0,
  title               text NOT NULL,
  slug                text NOT NULL,
  content_md          text NOT NULL DEFAULT '',
  importance          text NOT NULL DEFAULT 'common'
                      CONSTRAINT ck_exam_408_study_importance
                      CHECK (importance IN ('must', 'common', 'understand', 'rare', 'none')),
  exam_frequency      int NOT NULL DEFAULT 0 CHECK (exam_frequency >= 0),
  tags                jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_topic_ids   jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_point_key text REFERENCES exam_408_knowledge_points(key) ON DELETE SET NULL,
  source_url          text,
  sort_order          int NOT NULL DEFAULT 0,
  fingerprint         text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'published'
                      CONSTRAINT ck_exam_408_study_status
                      CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, slug)
);

CREATE INDEX IF NOT EXISTS idx_exam_408_study_subject
  ON exam_408_study_topics(subject_key, chapter_order, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_408_study_point
  ON exam_408_study_topics(knowledge_point_key) WHERE knowledge_point_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_exam_408_study_topics_updated ON exam_408_study_topics;
CREATE TRIGGER trg_exam_408_study_topics_updated
  BEFORE UPDATE ON exam_408_study_topics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
