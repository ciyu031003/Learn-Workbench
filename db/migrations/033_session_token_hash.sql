-- ============================================================================
-- 033_session_token_hash.sql —— P1 安全加固：会话令牌哈希化（幂等，可重复执行）
--
--  风险：sessions.token 明文存原始令牌，数据库/备份一旦泄露即可接管全部在线会话。
--  方案：新增 token_hash = sha256(token)，代码只读 token_hash；过渡期双写保留
--        token 列（回滚到旧代码仍可用）。全部旧会话自然过期（30 天 TTL）后，
--        可执行下方「收敛 DDL」删除明文列并迁移主键。
-- ============================================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash text;

-- 回填存量会话（旧代码创建的行）
UPDATE sessions SET token_hash = encode(sha256(token::bytea), 'hex') WHERE token_hash IS NULL;

-- 查找/唯一性走哈希列（部分唯一索引同时充当查找索引）
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_token_hash
  ON sessions (token_hash) WHERE token_hash IS NOT NULL;

-- ---------- 过期数据清理支撑索引（配合 /api/internal/cron 维护任务） ----------
-- 防御式建索引：所属表来自后续迁移，落后库/新库上不存在时跳过（生产按序执行均存在）
DO $$
BEGIN
  IF to_regclass('public.sessions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
  END IF;
  IF to_regclass('public.auth_attempts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_auth_attempts_created_at ON auth_attempts (created_at);
  END IF;
  IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_prt_expires_at ON password_reset_tokens (expires_at);
  END IF;
END
$$;

-- ============================================================================
-- 收敛 DDL（过渡期结束后手工执行，勿并入常规迁移）：
--   DELETE FROM sessions WHERE token_hash IS NULL;
--   ALTER TABLE sessions DROP CONSTRAINT sessions_pkey;
--   ALTER TABLE sessions ALTER COLUMN token_hash SET NOT NULL;
--   ALTER TABLE sessions DROP COLUMN token;
--   ALTER TABLE sessions ADD PRIMARY KEY (token_hash);
-- ============================================================================
