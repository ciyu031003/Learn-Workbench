-- ============================================================================
-- 081_sync_seq.sql —— sync_changes 增加单调序号 seq（S5-2 同步协议 v2，幂等）
--
-- 背景
--  - v2 push 要逐条回执并可做"平局裁决"：同一 updated_at 时以服务端 seq 大者胜
--    （客户端时钟精度只到秒/毫秒，多设备同秒写入是真实场景）。
--  - sync_changes.id 虽然是 bigserial，但语义是"变更日志主键"；显式 seq 把
--    "冲突裁决序号"从日志主键里独立出来，将来清理/归档 sync_changes 也不会改变语义。
--
-- 做法
--  - 加 seq bigserial（bigint + 自有序列；已有行按物理顺序回填，全表重写一次）；
--  - 唯一索引保证单调唯一；user_id+seq 支持按用户回放/排查。
--  - 只加列与索引，不动任何既有约束 → v1 的 upsert/幂等语义完全保留。
--
-- 回滚：db/migrations/down/081_sync_seq.down.sql
-- ============================================================================

ALTER TABLE sync_changes ADD COLUMN IF NOT EXISTS seq bigserial;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_changes_seq ON sync_changes (seq);
CREATE INDEX IF NOT EXISTS idx_sync_changes_user_seq ON sync_changes (user_id, seq);
