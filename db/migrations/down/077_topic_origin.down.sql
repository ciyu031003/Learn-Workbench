-- 077 回滚：移除知识点来源标记与术语列。
DROP INDEX IF EXISTS idx_learning_topics_origin;
ALTER TABLE learning_topics DROP CONSTRAINT IF EXISTS ck_learning_topics_origin;
ALTER TABLE learning_topics DROP COLUMN IF EXISTS origin;
