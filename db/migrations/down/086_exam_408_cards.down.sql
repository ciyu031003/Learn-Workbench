-- 回滚 086：删除 408 速记卡内容表（SRS 状态在 learning_review_cards，不受影响）
DROP INDEX IF EXISTS idx_exam_408_cards_subject;
DROP INDEX IF EXISTS idx_exam_408_cards_point;
DROP INDEX IF EXISTS idx_exam_408_cards_demo;
DROP TRIGGER IF EXISTS trg_exam_408_cards_updated ON exam_408_cards;
DROP TABLE IF EXISTS exam_408_cards;
