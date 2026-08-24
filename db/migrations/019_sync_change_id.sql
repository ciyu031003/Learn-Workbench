-- ============================================================================
-- 019：同步变更幂等键（B5）
-- 客户端为每条变更生成稳定 change_id（UUID）；服务端按 (user_id, change_id)
-- 去重：重试推送不再重复 apply、不再重复记录 sync_changes 审计日志。
-- ============================================================================

ALTER TABLE sync_changes ADD COLUMN IF NOT EXISTS change_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_changes_user_change
  ON sync_changes(user_id, change_id) WHERE change_id IS NOT NULL;
