-- ============================================================================
-- 006：Wellbeing 健康与状态领域（方案 §3、§6、§9、§16）
-- Reminder / Hydration / Energy / Break —— 第一版 MVP 闭环：
--   Focus → Break(站立+喝水+远眺) → Energy → 继续学习
-- 隐私：Owner Only，默认不公开；软删除 + client_id 对齐增量同步架构。
-- ============================================================================

-- 1) 提醒规则（方案 §3.2 Reminder）
CREATE TABLE IF NOT EXISTS wellbeing_reminders (
  id                bigserial PRIMARY KEY,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  type              text NOT NULL DEFAULT 'CUSTOM' CHECK (type IN ('HYDRATION','STAND','BREAK','MOVEMENT','SLEEP','CUSTOM')),
  title             text NOT NULL,
  message           text,
  enabled           boolean NOT NULL DEFAULT true,
  interval_minutes  int  NOT NULL DEFAULT 60 CHECK (interval_minutes BETWEEN 1 AND 1440),
  start_time        text NOT NULL DEFAULT '09:00',
  end_time          text NOT NULL DEFAULT '22:00',
  weekdays          int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  last_triggered_at timestamptz,
  next_trigger_at   timestamptz,
  deleted_at        timestamptz,
  client_id         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wb_reminders_user ON wellbeing_reminders(user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wb_reminders_client ON wellbeing_reminders(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_wb_reminders_updated ON wellbeing_reminders;
CREATE TRIGGER trg_wb_reminders_updated BEFORE UPDATE ON wellbeing_reminders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) 饮水记录（方案 §3.3 Hydration）
CREATE TABLE IF NOT EXISTS hydration_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  amount_ml   int NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 2000),
  source      text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','REMINDER','FOCUS_BREAK')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  client_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hydration_user_day ON hydration_logs(user_id, recorded_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hydration_client ON hydration_logs(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_hydration_updated ON hydration_logs;
CREATE TRIGGER trg_hydration_updated BEFORE UPDATE ON hydration_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) 饮水目标（方案 §3.3 HydrationGoal）
CREATE TABLE IF NOT EXISTS hydration_goals (
  id             bigserial PRIMARY KEY,
  user_id        uuid REFERENCES users(id) ON DELETE CASCADE,
  target_ml      int NOT NULL DEFAULT 2000 CHECK (target_ml BETWEEN 200 AND 10000),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hydration_goals_user ON hydration_goals(user_id, effective_from DESC);

-- 4) 精力记录（方案 §3.5 Energy）
CREATE TABLE IF NOT EXISTS energy_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  level       int NOT NULL CHECK (level BETWEEN 1 AND 5),
  note        text,
  source      text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','AFTER_FOCUS','MORNING')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  client_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_energy_user_day ON energy_logs(user_id, recorded_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_energy_client ON energy_logs(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_energy_updated ON energy_logs;
CREATE TRIGGER trg_energy_updated BEFORE UPDATE ON energy_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5) 休息记录（方案 §3.4 BreakSession）
CREATE TABLE IF NOT EXISTS break_sessions (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'SHORT' CHECK (kind IN ('SHORT','LONG','MOVEMENT','EYE_REST','MEAL')),
  minutes    int NOT NULL DEFAULT 5 CHECK (minutes BETWEEN 1 AND 240),
  note       text,
  started_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  client_id  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_breaks_user_day ON break_sessions(user_id, started_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_breaks_client ON break_sessions(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_breaks_updated ON break_sessions;
CREATE TRIGGER trg_breaks_updated BEFORE UPDATE ON break_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
