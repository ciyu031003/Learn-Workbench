-- 051：用户上传图片（运动档案的头图 / 装备图等）
-- 图片本体放 COS 桶（生产挂在 web 容器的 public/uploads），这里只登记元数据（配额、清理、审计）。
-- 幂等：IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS uploads (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'other',   -- avatar / racket / shoes / string / grip / ball / other
  path       text NOT NULL,                   -- 相对路径：<userId>/<uuid>.webp
  mime       text NOT NULL DEFAULT 'image/webp',
  bytes      integer NOT NULL,
  width      integer,
  height     integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_uploads_path ON uploads(path);
CREATE INDEX IF NOT EXISTS idx_uploads_user
  ON uploads(user_id, created_at DESC) WHERE deleted_at IS NULL;

