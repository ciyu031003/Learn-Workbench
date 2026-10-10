-- 回滚契约（067）：删除题目生命周期表与它带的对象。
DROP TRIGGER IF EXISTS trg_learning_questions_updated ON learning_questions;
DROP INDEX IF EXISTS idx_learning_questions_topic;
DROP INDEX IF EXISTS idx_learning_questions_status;
DROP INDEX IF EXISTS idx_learning_questions_track;
DROP TABLE IF EXISTS learning_questions;
