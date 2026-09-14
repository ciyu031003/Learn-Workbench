-- 039：Habit 独立领域——habits + habit_logs（D4 确认走 B1：新建独立表，不污染 domain_trackers 通用计量）
-- 习惯：streak（连续）/ schedule（周几）/ One-Tap 打卡；与「跑量/单词量」这类可量化 tracker 并存。

CREATE TABLE IF NOT EXISTS habits (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id      text,
  name         text NOT NULL,
  icon         text,                                  -- emoji 或图标键
  is_boolean   boolean NOT NULL DEFAULT true,         -- true=打卡型，false=可量化型
  target_value numeric,                               -- 量化型目标（如 8 杯水）
  unit         text,                                  -- 量化单位（杯 / 页 / 分钟）
  schedule     int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=周日 .. 6=周六
  color        text NOT NULL DEFAULT '#6366f1',
  sort_order   int NOT NULL DEFAULT 0,
  archived_at  timestamptz,
  deleted_at   timestamptz,
  client_id    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 同名习惯唯一（未删除）；匿名设备域用 anon_id 隔离
CREATE UNIQUE INDEX IF NOT EXISTS uq_habits_user_name
  ON habits(user_id, lower(name)) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_habits_anon ON habits(anon_id) WHERE deleted_at IS NULL AND user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_habits_client
  ON habits(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS habit_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  habit_id   bigint NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date   date NOT NULL,
  value      numeric NOT NULL DEFAULT 1,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, habit_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id, log_date);

DROP TRIGGER IF EXISTS trg_habits_updated ON habits;
CREATE TRIGGER trg_habits_updated BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_habit_logs_updated ON habit_logs;
CREATE TRIGGER trg_habit_logs_updated BEFORE UPDATE ON habit_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();