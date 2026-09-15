-- 045_weight_logs.sql
-- APP v3 阶段 P3（M8）：体重趋势。
-- 之前只有 user_settings.weight_kg 单值（无法画趋势）；此处增加按日记录。
-- 写入时同步 user_settings.weight_kg = 最新值（MET 卡路里估算依赖它）。

CREATE TABLE IF NOT EXISTS weight_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id    text,
  log_date   date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg  numeric NOT NULL CHECK (weight_kg BETWEEN 20 AND 300),
  note       text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 每作用域每天一条（同日重复记录 = 覆盖）
CREATE UNIQUE INDEX IF NOT EXISTS uq_weight_logs_user_date
  ON weight_logs(user_id, log_date) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_weight_logs_anon_date
  ON weight_logs(anon_id, log_date) WHERE deleted_at IS NULL AND user_id IS NULL AND anon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date
  ON weight_logs(user_id, log_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_weight_logs_anon_date
  ON weight_logs(anon_id, log_date DESC) WHERE deleted_at IS NULL AND user_id IS NULL;
