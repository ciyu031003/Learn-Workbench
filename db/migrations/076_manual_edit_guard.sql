-- 076：人工编辑保护（075 之后内容在库里可改，同步不能把人的改动冲掉）
--
-- 问题：075 之后前台从库里读内容，运营在 /settings/content 改的题/知识点会被
-- 下一次「内容包 → 库」同步（cron ?job=content）用文件里的旧内容覆盖 —— 静默丢改动。
--
-- 方案：加 `manually_edited_at`。后台编辑打上时间戳；同步的 ON CONFLICT DO UPDATE
-- 带 `WHERE manually_edited_at IS NULL`，即**人工改过就不再被文件覆盖**。
-- 需要强制以文件为准时，先清空该列（或用同步接口的 force 选项）。
--
-- 回滚：db/migrations/down/076_manual_edit_guard.down.sql

ALTER TABLE learning_questions
  ADD COLUMN IF NOT EXISTS manually_edited_at timestamptz;
ALTER TABLE learning_topics
  ADD COLUMN IF NOT EXISTS manually_edited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_learning_questions_manual
  ON learning_questions(manually_edited_at) WHERE manually_edited_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_topics_manual
  ON learning_topics(manually_edited_at) WHERE manually_edited_at IS NOT NULL;
