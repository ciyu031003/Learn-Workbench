-- 091: 简历文件「领域标签 + 默认简历」（P1-5）
--
-- 目标：一份简历可打领域标签（后端/前端/数据/算法/通用/其他，白名单在 API 侧校验），
-- 并可设为「默认简历」（投递/预览时优先用）。两者都只影响展示与选择，不动文件本体与存储路径。
--
-- 幂等：ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS（生产只跑新迁移，可重复执行）。
ALTER TABLE resume_files
  ADD COLUMN IF NOT EXISTS label      text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 每个用户最多一条默认简历；软删的行不占用名额。
-- 部分唯一索引是「默认互斥」的最终保证：即使并发 PATCH，也只会有一条 is_default=true。
CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_files_default
  ON resume_files(user_id) WHERE is_default AND deleted_at IS NULL;

COMMENT ON COLUMN resume_files.label      IS '领域标签（后端/前端/数据/算法/通用/其他），NULL = 未打标';
COMMENT ON COLUMN resume_files.is_default IS '是否该用户的默认简历；同一用户最多一条（uq_resume_files_default 保证）';
