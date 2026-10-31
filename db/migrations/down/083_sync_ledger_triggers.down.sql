-- ============================================================================
-- 083_sync_ledger_triggers.down.sql —— 回滚 ledger 触发器
--
-- 回滚后行为：web 端直写不再进 sync_changes；pull 仍可用（v2 游标路径将只看到
-- push 路径写入的行——回滚前应先把移动端回退到 legacy since 拉取，或接受增量缺口）。
-- 由 migration-drill 当作可执行回滚契约演练。
-- ============================================================================

DROP TRIGGER IF EXISTS trg_sync_ledger_habit_logs ON habit_logs;
DROP TRIGGER IF EXISTS trg_sync_ledger_habits ON habits;
DROP TRIGGER IF EXISTS trg_sync_ledger_certificates ON certificates;
DROP TRIGGER IF EXISTS trg_sync_ledger_exercise_logs ON exercise_logs;
DROP TRIGGER IF EXISTS trg_sync_ledger_content_topics ON content_topics;
DROP TRIGGER IF EXISTS trg_sync_ledger_resume_assets ON resume_assets;
DROP TRIGGER IF EXISTS trg_sync_ledger_log_entries ON log_entries;
DROP TRIGGER IF EXISTS trg_sync_ledger_checkins ON checkins;
DROP TRIGGER IF EXISTS trg_sync_ledger_focus_sessions ON focus_sessions;
DROP TRIGGER IF EXISTS trg_sync_ledger_daily_tasks ON daily_tasks;
DROP TRIGGER IF EXISTS trg_sync_ledger_topic_progress ON topic_progress;

DROP FUNCTION IF EXISTS fn_sync_changes_capture();
