-- 075 回滚：移除学习内容全量入库新增的表与列。
-- 注意：learning_questions 的内容列有 DEFAULT，回滚会丢弃题干/选项/答案（内容仍在 packages/content，可重新同步）。
DROP TRIGGER IF EXISTS trg_learning_topics_updated ON learning_topics;
DROP TRIGGER IF EXISTS trg_learning_stages_updated ON learning_stages;
DROP TRIGGER IF EXISTS trg_learning_tracks_updated ON learning_tracks;
DROP TABLE IF EXISTS learning_animations;
DROP TABLE IF EXISTS learning_sources;
DROP TABLE IF EXISTS learning_topics;
DROP TABLE IF EXISTS learning_stages;
DROP TABLE IF EXISTS learning_tracks;
ALTER TABLE learning_questions
  DROP COLUMN IF EXISTS stem,
  DROP COLUMN IF EXISTS options,
  DROP COLUMN IF EXISTS answer,
  DROP COLUMN IF EXISTS explanation,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS sort_order;
