-- 093: 用户头像
--
-- display_name 已存在（users 表），头像此前只散落在微信 identities / 运动档案里。
-- 个人资料需要一处稳定的头像 URL，供「我的」与今日页共用；仅允许站内上传地址。
--
-- 幂等：IF NOT EXISTS，生产只跑新迁移，可重复执行。

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
