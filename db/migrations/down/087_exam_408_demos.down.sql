-- 回滚 087：删除 408 交互演示表（帧文件可重抓）
DROP INDEX IF EXISTS idx_exam_408_demos_subject;
DROP INDEX IF EXISTS idx_exam_408_demos_point;
DROP TRIGGER IF EXISTS trg_exam_408_demos_updated ON exam_408_demos;
DROP TABLE IF EXISTS exam_408_demos;
