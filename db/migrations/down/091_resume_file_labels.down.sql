-- 回滚 091：删除领域标签与默认简历列（索引随列一并失效，先单独 DROP 便于排查）
DROP INDEX IF EXISTS uq_resume_files_default;
ALTER TABLE resume_files
  DROP COLUMN IF EXISTS is_default,
  DROP COLUMN IF EXISTS label;
