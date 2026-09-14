-- 040：Fitness Plan（本期轻量 A）——workouts + workout_items
-- D5 确认：本期只做「轻量 Workout 记录」（动作/组数/次数/重量），wger 式 Workout→Exercise→Set
-- 完整计划编排记为下一阶段；训练计时复用现有 Focus/全屏计时，不新建计时器。

CREATE TABLE IF NOT EXISTS workouts (
  id               bigserial PRIMARY KEY,
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id          text,
  name             text NOT NULL DEFAULT '训练',
  exercised_on     date NOT NULL DEFAULT CURRENT_DATE,
  duration_seconds int NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),
  note             text,
  deleted_at       timestamptz,
  client_id        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date
  ON workouts(user_id, exercised_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workouts_anon
  ON workouts(anon_id, exercised_on DESC) WHERE deleted_at IS NULL AND user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_workouts_client
  ON workouts(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workout_items (
  id               bigserial PRIMARY KEY,
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  workout_id       bigint NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_key     text,                        -- 对齐 SPORT_CATALOG / 自由动作键
  exercise_label   text NOT NULL,               -- 展示名（卧推 / 深蹲）
  sets             int NOT NULL DEFAULT 1 CHECK (sets BETWEEN 0 AND 200),
  reps             int NOT NULL DEFAULT 1 CHECK (reps BETWEEN 0 AND 2000),
  weight_kg        numeric CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 2000)),
  duration_seconds int NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_items_workout ON workout_items(workout_id, sort_order);

DROP TRIGGER IF EXISTS trg_workouts_updated ON workouts;
CREATE TRIGGER trg_workouts_updated BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_workout_items_updated ON workout_items;
CREATE TRIGGER trg_workout_items_updated BEFORE UPDATE ON workout_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();