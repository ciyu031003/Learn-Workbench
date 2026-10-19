-- ============================================================================
-- 080_migration_checksums.sql —— 迁移台账加校验和（S4-1，幂等）
--
-- 目的：让"迁移执行器"能发现「已应用的文件被就地修改」——此前 schema_migrations 只存
-- filename，历史迁移被改过也无人察觉，本机与生产会长期分叉。
--
-- 兼容：090 以前由 scripts/docker-init-db.sh 建表；这里 CREATE IF NOT EXISTS 兜底，
-- 再增量加列，旧库/新库都能收敛。
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text;

-- 历史行没有 checksum：执行器首次运行会按磁盘文件回填（scripts/migrate.mjs / docker-init-db.sh）
COMMENT ON COLUMN schema_migrations.checksum IS 'sha256(文件内容)；迁移执行器据此发现"已应用文件被修改"';
