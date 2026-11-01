-- 086: 408 速记卡（408card.top 镜像）——SRS 状态复用 learning_review_cards
-- 卡内容与卡状态分离：exam_408_cards 是内容表；学习状态沿用 learning_review_cards
-- （question_key = exam_408_cards.key，track_slug = 'ex-408-cards'，stage_key = 科目 key）。
CREATE TABLE IF NOT EXISTS exam_408_cards (
  key                 text PRIMARY KEY,
  source_key          text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  subject_key         text NOT NULL,
  chapter             int NOT NULL CHECK (chapter > 0),
  knowledge_point_key text REFERENCES exam_408_knowledge_points(key) ON DELETE SET NULL,
  question            text NOT NULL,
  answer_steps        jsonb NOT NULL DEFAULT '[]'::jsonb,
  pitfall             text,
  mnemonic            text,
  star                boolean NOT NULL DEFAULT false,
  demo_key            text,
  sort_order          int NOT NULL DEFAULT 0,
  fingerprint         text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'published'
                      CONSTRAINT ck_exam_408_cards_status
                      CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, key)
);

CREATE INDEX IF NOT EXISTS idx_exam_408_cards_subject
  ON exam_408_cards(subject_key, chapter, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_408_cards_point
  ON exam_408_cards(knowledge_point_key) WHERE knowledge_point_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_408_cards_demo
  ON exam_408_cards(demo_key) WHERE demo_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_exam_408_cards_updated ON exam_408_cards;
CREATE TRIGGER trg_exam_408_cards_updated
  BEFORE UPDATE ON exam_408_cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
