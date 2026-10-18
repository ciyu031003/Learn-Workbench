-- ============================================================================
-- 079 回滚（S2-3b）
--
-- 1) 删生命周期 / 设备信息三列。
-- 2) 恢复 token 主键 + NOT NULL：**只在没有 token IS NULL 的行时**才做 ——
--    新代码创建的会话 token 为空，硬恢复 NOT NULL 会直接失败；回滚也不该静默
--    删除或伪造会话（那会让用户莫名其妙掉线）。有 NULL 行时保留「代理 id 主键 +
--    token 可空」，并输出 NOTICE 说明。
-- ============================================================================

ALTER TABLE sessions DROP COLUMN IF EXISTS last_used_at;
ALTER TABLE sessions DROP COLUMN IF EXISTS user_agent;
ALTER TABLE sessions DROP COLUMN IF EXISTS device_label;
DROP INDEX IF EXISTS idx_sessions_user_active;

DO $$
BEGIN
  IF to_regclass('public.sessions') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM sessions WHERE token IS NULL) THEN
    RAISE NOTICE '[079 down] sessions 存在 token IS NULL 的行，跳过恢复 token 主键/非空（需先人工处理这些会话）';
    RETURN;
  END IF;

  DROP INDEX IF EXISTS uq_sessions_token;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sessions'::regclass AND conname = 'sessions_pkey'
  ) THEN
    ALTER TABLE sessions DROP CONSTRAINT sessions_pkey;
  END IF;

  ALTER TABLE sessions DROP COLUMN IF EXISTS id;
  ALTER TABLE sessions ALTER COLUMN token SET NOT NULL;
  ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (token);
END $$;
