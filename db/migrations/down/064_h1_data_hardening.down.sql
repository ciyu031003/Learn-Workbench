-- 064 回滚：H1 数据工程严谨性
--
-- 只回滚本迁移新增的对象，不动任何既有数据（DROP COLUMN 会丢这三列的值，
-- 但它们仅用于审计/乐观锁，属于本迁移自建，回滚即弃）。索引 DROP 无损。
-- 由 scripts/migration-drill.mjs 在演练库上执行，用于验证"可回滚"。

DROP INDEX IF EXISTS idx_accounts_user;
DROP INDEX IF EXISTS idx_daily_tasks_phase;
DROP INDEX IF EXISTS idx_daily_tasks_topic;
DROP INDEX IF EXISTS idx_focus_sessions_task;
DROP INDEX IF EXISTS idx_interview_attempts_phase;
DROP INDEX IF EXISTS idx_job_notifications_job;
DROP INDEX IF EXISTS idx_job_notifications_sub;
DROP INDEX IF EXISTS idx_job_skill_links_skill;
DROP INDEX IF EXISTS idx_knowledge_note_tags_tag;
DROP INDEX IF EXISTS idx_meal_entries_food;
DROP INDEX IF EXISTS idx_skill_content_links_topic;
DROP INDEX IF EXISTS idx_user_skills_skill;
DROP INDEX IF EXISTS idx_workout_items_user;

ALTER TABLE content_phases   DROP CONSTRAINT IF EXISTS ck_content_phases_version;
ALTER TABLE content_topics   DROP CONSTRAINT IF EXISTS ck_content_topics_version;
ALTER TABLE knowledge_points DROP CONSTRAINT IF EXISTS ck_knowledge_points_version;
ALTER TABLE content_source   DROP CONSTRAINT IF EXISTS ck_content_source_version;

ALTER TABLE content_phases   DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by, DROP COLUMN IF EXISTS version;
ALTER TABLE content_topics   DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by, DROP COLUMN IF EXISTS version;
ALTER TABLE knowledge_points DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by, DROP COLUMN IF EXISTS version;
ALTER TABLE content_source   DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by, DROP COLUMN IF EXISTS version;
