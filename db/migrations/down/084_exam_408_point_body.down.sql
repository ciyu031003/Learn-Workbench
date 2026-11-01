-- 回滚 084：移除 408 专区知识点正文列（正文可由 point-bodies/*.json 重新写入）
ALTER TABLE exam_408_knowledge_points
  DROP COLUMN IF EXISTS body;
