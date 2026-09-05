-- 032：exercise_logs 客户端幂等索引——移动端记录经 /api/sync 入库（client_id 去重，LWW）
-- 建表时（023）已有 client_id 列但无唯一约束；与 focus_sessions（028）同款处理。

CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_logs_client
  ON exercise_logs(user_id, client_id)
  WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
