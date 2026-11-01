-- 回滚 085：删除 408 精读正文表（正文可由 cs408-snapshot.json 重导）
DROP INDEX IF EXISTS idx_exam_408_study_subject;
DROP INDEX IF EXISTS idx_exam_408_study_point;
DROP TRIGGER IF EXISTS trg_exam_408_study_topics_updated ON exam_408_study_topics;
DROP TABLE IF EXISTS exam_408_study_topics;
