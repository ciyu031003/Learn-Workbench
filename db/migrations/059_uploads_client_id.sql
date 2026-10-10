-- 059：图片上传幂等键（组一 · 阶段 1「图片上传可靠性」）
-- 移动端图片发件箱在离线/5xx 时会保留待发送操作并重试补发；
-- 服务端按 (user_id, client_id) 去重，保证同一次选图不会在桶里和 uploads 表里落两份。
-- 部分唯一索引：client_id 为 NULL 的历史数据（网页端直传）不受影响；
-- 已软删的行也不占用键位，用户删图后重新选同一张图（新 clientId 或旧 clientId 补发）都不会被卡住。
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS client_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_uploads_user_client
  ON uploads(user_id, client_id) WHERE client_id IS NOT NULL AND deleted_at IS NULL;
