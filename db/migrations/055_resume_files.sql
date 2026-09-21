-- 055：简历文件（v12 P2-2）
-- 用户上传的 PDF / Word 简历：文件本体落 COS（<RESUME_DIR>），这里只登记元数据。
-- 与 uploads（图片）分开：简历不进 nginx 直出目录，取文件必须走 /api/resume-files/[id] 且是本人。

CREATE TABLE IF NOT EXISTS resume_files (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name  text NOT NULL,              -- 用户原始文件名（展示用）
  path       text NOT NULL,              -- 桶内相对路径 <userId>/<uuid>.<ext>
  mime       text NOT NULL,
  bytes      integer NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_files_user
  ON resume_files(user_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_resume_files_updated ON resume_files;
CREATE TRIGGER trg_resume_files_updated BEFORE UPDATE ON resume_files
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
