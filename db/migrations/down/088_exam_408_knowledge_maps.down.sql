-- 回滚 088：删除章节知识图谱表（数据可由 extract-maps + import-maps 重导）
DROP INDEX IF EXISTS idx_exam_408_maps_subject;
DROP INDEX IF EXISTS idx_exam_408_maps_topic;
DROP TRIGGER IF EXISTS trg_exam_408_maps_updated ON exam_408_knowledge_maps;
DROP TABLE IF EXISTS exam_408_knowledge_maps;
