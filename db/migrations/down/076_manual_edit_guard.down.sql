-- 076 回滚：移除人工编辑保护列（回滚后同步会重新以内容包为准）。
DROP INDEX IF EXISTS idx_learning_topics_manual;
DROP INDEX IF EXISTS idx_learning_questions_manual;
ALTER TABLE learning_topics DROP COLUMN IF EXISTS manually_edited_at;
ALTER TABLE learning_questions DROP COLUMN IF EXISTS manually_edited_at;
