-- 回滚 093：删除用户头像列（列删除不回滚对象存储里的图片文件，桶内可人工清理）
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
