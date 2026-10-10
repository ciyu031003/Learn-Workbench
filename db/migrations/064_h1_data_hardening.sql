-- 064：H1 数据工程严谨性（组三 · 阶段 15 = V3 横轨 H1）
--
-- 只补事实、不改语义，三件事：
--   1) 运营可编辑的内容表补审计列（created_by / updated_by）与乐观锁（version）：
--      回答"谁改的、改了几次、有没有并发覆盖"。学习者数据表不加（无人工编辑入口）；
--   2) 补 13 条外键缺支撑索引：引用列上的 DELETE/UPDATE 与 JOIN 会退化成全表扫；
--   3) 乐观锁加 CHECK (version > 0)，防脏写把计数写成 0/负数。
--
-- 证据来源：在 check-schema-fresh 造出的全量库上查 pg_constraint 得出的缺索引清单，
--           已登记进 content-platform/db/index-inventory.md（脚本可从 DDL 再生）。
-- 幂等：ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DO 块吞 duplicate_object；
--        db/schema.sql 已同步登记，全新库与既有库收敛到同一结构。
-- 回滚：064_h1_data_hardening.down.sql（drop 索引与列，数据无损）。

-- ============================ 1) 审计列与乐观锁 ============================

ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS version    int NOT NULL DEFAULT 1;

ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS version    int NOT NULL DEFAULT 1;

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS version    int NOT NULL DEFAULT 1;

ALTER TABLE content_source ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE content_source ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE content_source ADD COLUMN IF NOT EXISTS version    int NOT NULL DEFAULT 1;

DO $$
BEGIN
  ALTER TABLE content_phases ADD CONSTRAINT ck_content_phases_version CHECK (version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_topics ADD CONSTRAINT ck_content_topics_version CHECK (version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE knowledge_points ADD CONSTRAINT ck_knowledge_points_version CHECK (version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_source ADD CONSTRAINT ck_content_source_version CHECK (version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================ 2) 外键支撑索引 ============================

CREATE INDEX IF NOT EXISTS idx_accounts_user             ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_phase         ON daily_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_topic         ON daily_tasks(topic_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task       ON focus_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_phase  ON interview_attempts(phase_id);
CREATE INDEX IF NOT EXISTS idx_job_notifications_job     ON job_notifications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_notifications_sub     ON job_notifications(subscription_id);
CREATE INDEX IF NOT EXISTS idx_job_skill_links_skill     ON job_skill_links(skill_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_note_tags_tag   ON knowledge_note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_meal_entries_food         ON meal_entries(food_id);
CREATE INDEX IF NOT EXISTS idx_skill_content_links_topic ON skill_content_links(topic_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill         ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_workout_items_user        ON workout_items(user_id);
