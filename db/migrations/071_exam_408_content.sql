-- 071: 408 exam content tables
--
-- Store the public-site snapshot as a first-class exam domain instead of
-- overloading the generic learning content tables. The import script owns
-- rows with source_key='beokayy-408' and upserts them idempotently.

CREATE TABLE IF NOT EXISTS exam_408_source_snapshots (
  key             text PRIMARY KEY,
  name            text NOT NULL,
  base_url        text NOT NULL,
  license_note    text NOT NULL,
  usage_scope     text NOT NULL DEFAULT 'personal-study',
  captured_at     timestamptz,
  bundle_url      text,
  bundle_sha256   text,
  manifest_sha256 text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_408_subjects (
  key        text PRIMARY KEY,
  source_key text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  short_name text NOT NULL,
  title      text NOT NULL,
  sort_order int NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_key, title)
);

CREATE TABLE IF NOT EXISTS exam_408_chapters (
  key            text PRIMARY KEY,
  source_key     text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  subject_key    text NOT NULL REFERENCES exam_408_subjects(key) ON DELETE CASCADE,
  chapter_number int NOT NULL CHECK (chapter_number > 0),
  title          text NOT NULL,
  sort_order     int NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  question_count int NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  source_url     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_key, chapter_number)
);

CREATE TABLE IF NOT EXISTS exam_408_knowledge_points (
  key            text PRIMARY KEY,
  source_key     text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  subject_key    text NOT NULL REFERENCES exam_408_subjects(key) ON DELETE CASCADE,
  chapter_key    text NOT NULL REFERENCES exam_408_chapters(key) ON DELETE CASCADE,
  point_number   int NOT NULL CHECK (point_number > 0),
  title          text NOT NULL,
  summary        text NOT NULL DEFAULT '',
  sort_order     int NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  question_count int NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  tags           jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url     text,
  fingerprint    text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'published'
                 CONSTRAINT ck_exam_408_knowledge_points_status
                 CHECK (status IN ('draft','review','published','archived')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_key, point_number)
);

CREATE TABLE IF NOT EXISTS exam_408_papers (
  year           int PRIMARY KEY CHECK (year >= 2000),
  source_key     text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  title          text NOT NULL,
  total_score    int NOT NULL CHECK (total_score > 0),
  question_count int NOT NULL CHECK (question_count > 0),
  source_url     text,
  captured_at    timestamptz,
  fingerprint    text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'published'
                 CONSTRAINT ck_exam_408_papers_status
                 CHECK (status IN ('draft','review','published','archived')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_408_questions (
  key                text PRIMARY KEY,
  source_key         text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  paper_year         int NOT NULL REFERENCES exam_408_papers(year) ON DELETE CASCADE,
  question_id        text NOT NULL,
  question_number    int NOT NULL CHECK (question_number > 0),
  type               text NOT NULL
                     CONSTRAINT ck_exam_408_questions_type
                     CHECK (type IN ('choice','comprehensive')),
  subject_key        text NOT NULL REFERENCES exam_408_subjects(key) ON DELETE RESTRICT,
  points             int NOT NULL CHECK (points > 0),
  body               text NOT NULL,
  stem               text NOT NULL DEFAULT '',
  options            jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_text        text NOT NULL,
  answer_letter      text,
  image_refs         jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_image_refs  jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_image          boolean NOT NULL DEFAULT false,
  video_url          text,
  video_p_offset     int NOT NULL DEFAULT 0,
  missing_fields     jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_tags        jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags               jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url         text NOT NULL,
  fingerprint        text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'published'
                     CONSTRAINT ck_exam_408_questions_status
                     CHECK (status IN ('draft','review','published','archived')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_exam_408_questions_answer_letter
    CHECK (answer_letter IS NULL OR answer_letter IN ('A','B','C','D')),
  UNIQUE (paper_year, question_number),
  UNIQUE (question_id)
);

CREATE TABLE IF NOT EXISTS exam_408_tags (
  key             text PRIMARY KEY,
  source_key      text NOT NULL REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT,
  kind            text NOT NULL
                  CONSTRAINT ck_exam_408_tags_kind
                  CHECK (kind IN (
                    'source','exam','subject','year','question-type',
                    'chapter','knowledge-point','raw'
                  )),
  name            text NOT NULL,
  normalized_name text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, normalized_name)
);

CREATE TABLE IF NOT EXISTS exam_408_question_knowledge_points (
  question_key        text NOT NULL REFERENCES exam_408_questions(key) ON DELETE CASCADE,
  knowledge_point_key text NOT NULL REFERENCES exam_408_knowledge_points(key) ON DELETE CASCADE,
  link_source         text NOT NULL DEFAULT 'explicit'
                      CONSTRAINT ck_exam_408_qkp_link_source
                      CHECK (link_source IN ('explicit','curated')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_key, knowledge_point_key)
);

CREATE TABLE IF NOT EXISTS exam_408_question_tags (
  question_key text NOT NULL REFERENCES exam_408_questions(key) ON DELETE CASCADE,
  tag_key      text NOT NULL REFERENCES exam_408_tags(key) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_key, tag_key)
);

CREATE TABLE IF NOT EXISTS exam_408_knowledge_point_tags (
  knowledge_point_key text NOT NULL REFERENCES exam_408_knowledge_points(key) ON DELETE CASCADE,
  tag_key             text NOT NULL REFERENCES exam_408_tags(key) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (knowledge_point_key, tag_key)
);

CREATE INDEX IF NOT EXISTS idx_exam_408_chapters_subject
  ON exam_408_chapters(subject_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_408_points_chapter
  ON exam_408_knowledge_points(chapter_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_408_points_subject
  ON exam_408_knowledge_points(subject_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_408_questions_paper
  ON exam_408_questions(paper_year, question_number);
CREATE INDEX IF NOT EXISTS idx_exam_408_questions_subject
  ON exam_408_questions(subject_key, paper_year, question_number);
CREATE INDEX IF NOT EXISTS idx_exam_408_questions_type
  ON exam_408_questions(type, paper_year, question_number);
CREATE INDEX IF NOT EXISTS idx_exam_408_questions_tags_gin
  ON exam_408_questions USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_exam_408_points_tags_gin
  ON exam_408_knowledge_points USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_exam_408_qkp_point
  ON exam_408_question_knowledge_points(knowledge_point_key, question_key);
CREATE INDEX IF NOT EXISTS idx_exam_408_question_tags_tag
  ON exam_408_question_tags(tag_key, question_key);
CREATE INDEX IF NOT EXISTS idx_exam_408_point_tags_tag
  ON exam_408_knowledge_point_tags(tag_key, knowledge_point_key);

DROP TRIGGER IF EXISTS trg_exam_408_source_snapshots_updated ON exam_408_source_snapshots;
CREATE TRIGGER trg_exam_408_source_snapshots_updated
  BEFORE UPDATE ON exam_408_source_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_408_subjects_updated ON exam_408_subjects;
CREATE TRIGGER trg_exam_408_subjects_updated
  BEFORE UPDATE ON exam_408_subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_408_chapters_updated ON exam_408_chapters;
CREATE TRIGGER trg_exam_408_chapters_updated
  BEFORE UPDATE ON exam_408_chapters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_408_knowledge_points_updated ON exam_408_knowledge_points;
CREATE TRIGGER trg_exam_408_knowledge_points_updated
  BEFORE UPDATE ON exam_408_knowledge_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_408_papers_updated ON exam_408_papers;
CREATE TRIGGER trg_exam_408_papers_updated
  BEFORE UPDATE ON exam_408_papers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_408_questions_updated ON exam_408_questions;
CREATE TRIGGER trg_exam_408_questions_updated
  BEFORE UPDATE ON exam_408_questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_408_tags_updated ON exam_408_tags;
CREATE TRIGGER trg_exam_408_tags_updated
  BEFORE UPDATE ON exam_408_tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO exam_408_source_snapshots (
  key, name, base_url, license_note, usage_scope, note
)
VALUES (
  'beokayy-408',
  '四〇八档案室 · 408 历年真题',
  'https://zhenti.beokayy.club/',
  '站点未声明开源或转载许可；仅个人、非商业、本地学习使用，不再分发。',
  'personal-study',
  '2009-2026 年 408 试卷、知识点索引、题目和标签快照。'
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  license_note = EXCLUDED.license_note,
  usage_scope = EXCLUDED.usage_scope,
  note = EXCLUDED.note,
  updated_at = now();
