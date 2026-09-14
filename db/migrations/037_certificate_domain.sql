-- 037：Certificate 独立领域——certificates 扩展为独立证书领域
-- 目的：从「简历里一行文字 / dashboard 只读列表」升级为独立领域：
--       颁发机构、取得日期、有效期（过期提醒）、证书缩略图、软删除、同步幂等。
-- 全部 nullable 纯增量，不破坏 dashboard/summary/export/import 既有用法。

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS issuer      text,
  ADD COLUMN IF NOT EXISTS earned_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS image_url   text,
  ADD COLUMN IF NOT EXISTS sort_order  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS client_id   text,
  ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now();

-- 常用查询：按用户取「未删除」证书（按有效期/目标日期排序）
CREATE INDEX IF NOT EXISTS idx_certs_user_alive
  ON certificates(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_certs_expiry
  ON certificates(expiry_date) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

-- 同步幂等（与 exercise_logs 同模式）
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_client
  ON certificates(user_id, client_id)
  WHERE user_id IS NOT NULL AND client_id IS NOT NULL;