-- 053：公开分享页是否展示装备图（用户开关，v11.2）
-- 默认 false：公开页默认只出文字装备，用户主动打开才展示自己上传/图库选的装备图。
ALTER TABLE sports_profiles
  ADD COLUMN IF NOT EXISTS show_gear_images boolean NOT NULL DEFAULT false;
