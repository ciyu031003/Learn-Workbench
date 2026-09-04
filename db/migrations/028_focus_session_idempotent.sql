-- 028：专注/运动会话幂等（开始即建 session + 期间续写 client_id 幂等）
-- 依赖：focus_sessions.client_id（005）、exercise_logs.client_id（023）
-- 新增 focus_minutes_applied：任务 focus_minutes 只累加一次（首次非零时长入账时置位）

ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS focus_minutes_applied boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_focus_sessions_client_anon
  ON focus_sessions(anon_id, client_id) WHERE anon_id IS NOT NULL AND client_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_logs_client
  ON exercise_logs(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_logs_client_anon
  ON exercise_logs(anon_id, client_id) WHERE anon_id IS NOT NULL AND client_id IS NOT NULL;
