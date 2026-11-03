-- 回滚 092：删除套卷历史成绩表（纯追加型用户数据，回滚即丢弃；不影响任何内容表）
DROP INDEX IF EXISTS idx_exam_408_paper_attempts_user_submitted;
DROP TABLE IF EXISTS exam_408_paper_attempts;
