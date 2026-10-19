-- 081 回滚：移除同步变更序号（v1 客户端不读 receipts.seq，回滚后协议降级为 v1）
DROP INDEX IF EXISTS idx_sync_changes_user_seq;
DROP INDEX IF EXISTS uq_sync_changes_seq;
ALTER TABLE sync_changes DROP COLUMN IF EXISTS seq;
