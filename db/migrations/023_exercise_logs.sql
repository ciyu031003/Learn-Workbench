-- ============================================================================
-- 023：运动模块——记录今日运动（健康/wellbeing 模块下的小类）
-- 需求：首页健康模块下新增「运动」，记录今天运动了哪些；支持
--        1) 专注运动时长（倒计时/计时器）；2) 运动类型选择（球类/有氧/力量等）。
-- 设计：
--  - type = 大类枚举（BALL/AEROBIC/STRENGTH/STRETCH/MOVE/OTHER），type_label 存
--    用户自定义运动名（如「篮球」「羽毛球」），未填时默认等于 type 的中文标签。
--  - duration_seconds 记录单次运动时长；source 区分来源（手动/专注/休息）。
--  - exercise_goals 记录每日运动目标（分钟），匿名用户同样带 anon_id 隔离。
--  - 与 break_sessions(kind='MOVEMENT') / focus_sessions 联动：运动完成后可可选写入。
-- ============================================================================

-- 1) 运动记录
CREATE TABLE IF NOT EXISTS exercise_logs (
  id               bigserial PRIMARY KEY,
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id          text,
  type             text NOT NULL DEFAULT 'OTHER'
                   CHECK (type IN ('BALL','AEROBIC','STRENGTH','STRETCH','MOVE','OTHER')),
  type_label       text,
  duration_seconds int NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),
  source           text NOT NULL DEFAULT 'MANUAL'
                   CHECK (source IN ('MANUAL','FOCUS','BREAK')),
  note             text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  client_id        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_user    ON exercise_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_started ON exercise_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_exercise_anon    ON exercise_logs(anon_id);

DROP TRIGGER IF EXISTS trg_exercise_logs_updated ON exercise_logs;
CREATE TRIGGER trg_exercise_logs_updated BEFORE UPDATE ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) 每日运动目标
CREATE TABLE IF NOT EXISTS exercise_goals (
  id             bigserial PRIMARY KEY,
  user_id        uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id        text,
  target_minutes int NOT NULL DEFAULT 30 CHECK (target_minutes BETWEEN 1 AND 600),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_goal_user ON exercise_goals(user_id);