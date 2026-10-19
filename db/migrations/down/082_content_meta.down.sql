-- 082 回滚：删除内容版本 marker 表。
-- 先删主键约束再删表：migration-drill 要求 down 能解析出可验证的 DROP 对象
-- （content_meta_pkey 由 up 的 PRIMARY KEY 自动命名，重新 up 后会被 drill 再次校验存在）。
ALTER TABLE content_meta DROP CONSTRAINT IF EXISTS content_meta_pkey;
DROP TABLE IF EXISTS content_meta;
