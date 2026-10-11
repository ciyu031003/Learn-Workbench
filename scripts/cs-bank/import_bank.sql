\pset pager off
\set ON_ERROR_STOP on
CREATE TEMP TABLE t_import (
  module text, question text, answer text, difficulty text, tags text,
  source_url text, source_site text, license text, external_key text
);
\copy t_import FROM '/tmp/bank.csv' WITH (FORMAT csv)
INSERT INTO interview_questions
  (module, question, answer, difficulty, tags, source_url, source_site, license, external_key, crawled_at, is_listed)
SELECT module, question, answer, difficulty, tags::jsonb, NULLIF(source_url, ''),
       source_site, license, external_key, now(), true
FROM t_import
-- 408 / 考研真题类题源不进面试题库（口径：只进技术题库的「408」分类，
-- 见 packages/content/src/learning/exam-408.ts + exam-bank.ts）
WHERE module NOT LIKE '408%' AND module NOT LIKE '考研真题%'
ON CONFLICT (external_key) WHERE external_key IS NOT NULL DO NOTHING;
SELECT 'total' AS k, count(*)::text AS v FROM interview_questions
UNION ALL SELECT 'local-material', count(*)::text FROM interview_questions WHERE source_site = 'local-material'
UNION ALL SELECT 'modules', count(DISTINCT module)::text FROM interview_questions WHERE is_listed;
