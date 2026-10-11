-- 回滚契约（071）：删除 408 真题域的全部对象（表 / 索引 / 触发器）。
--
-- 背景：此前这里只有 10 条 DROP TABLE，scripts/migration-drill.mjs 的 parseDownContract()
-- 只认 DROP INDEX / ALTER TABLE ... DROP CONSTRAINT|COLUMN，于是解析出 0 个对象、
-- 直接判「回滚契约形同空文」并 exit 1（db:drill 必红）。
-- 这里补齐 071 自己创建的 11 个索引与 7 个触发器（与 067 同款写法），让契约可被解析、可被演练断言。

-- 触发器（必须先于表删除，否则触发器随表一起消失，断言不到「回滚后不残留」）
DROP TRIGGER IF EXISTS trg_exam_408_source_snapshots_updated ON exam_408_source_snapshots;
DROP TRIGGER IF EXISTS trg_exam_408_subjects_updated ON exam_408_subjects;
DROP TRIGGER IF EXISTS trg_exam_408_chapters_updated ON exam_408_chapters;
DROP TRIGGER IF EXISTS trg_exam_408_knowledge_points_updated ON exam_408_knowledge_points;
DROP TRIGGER IF EXISTS trg_exam_408_papers_updated ON exam_408_papers;
DROP TRIGGER IF EXISTS trg_exam_408_questions_updated ON exam_408_questions;
DROP TRIGGER IF EXISTS trg_exam_408_tags_updated ON exam_408_tags;

-- 索引（GIN 索引与复合索引都由 071 正向创建）
DROP INDEX IF EXISTS idx_exam_408_chapters_subject;
DROP INDEX IF EXISTS idx_exam_408_points_chapter;
DROP INDEX IF EXISTS idx_exam_408_points_subject;
DROP INDEX IF EXISTS idx_exam_408_questions_paper;
DROP INDEX IF EXISTS idx_exam_408_questions_subject;
DROP INDEX IF EXISTS idx_exam_408_questions_type;
DROP INDEX IF EXISTS idx_exam_408_questions_tags_gin;
DROP INDEX IF EXISTS idx_exam_408_points_tags_gin;
DROP INDEX IF EXISTS idx_exam_408_qkp_point;
DROP INDEX IF EXISTS idx_exam_408_question_tags_tag;
DROP INDEX IF EXISTS idx_exam_408_point_tags_tag;

-- 表（自底向上：先删依赖方，再删被引用方）
DROP TABLE IF EXISTS exam_408_knowledge_point_tags;
DROP TABLE IF EXISTS exam_408_question_tags;
DROP TABLE IF EXISTS exam_408_question_knowledge_points;
DROP TABLE IF EXISTS exam_408_tags;
DROP TABLE IF EXISTS exam_408_questions;
DROP TABLE IF EXISTS exam_408_papers;
DROP TABLE IF EXISTS exam_408_knowledge_points;
DROP TABLE IF EXISTS exam_408_chapters;
DROP TABLE IF EXISTS exam_408_subjects;
DROP TABLE IF EXISTS exam_408_source_snapshots;
