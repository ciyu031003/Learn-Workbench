-- 031：用户设置（user_settings）——卡路里估算所需体重（P2：MET × 体重kg × 小时）
-- 每用户/匿名设备一行；未建行时按默认 60kg 处理（应用层兜底，读接口不强制建行）。

CREATE TABLE IF NOT EXISTS user_settings (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id    text,
  weight_kg  numeric NOT NULL DEFAULT 60 CHECK (weight_kg BETWEEN 20 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 每个作用域最多一行（登录用户 / 匿名设备各一条唯一约束）
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_settings_user ON user_settings(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_settings_anon ON user_settings(anon_id) WHERE user_id IS NULL AND anon_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_user_settings_updated ON user_settings;
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
