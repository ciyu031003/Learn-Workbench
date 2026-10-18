-- ============================================================================
-- 079_session_lifecycle.sql —— 会话生命周期 + 设备信息（S2-3b，幂等）
--
-- 背景
--  - 会话表此前只有 token_hash / user_id / created_at / expires_at：
--    用户看不到「哪些设备登录过」，也无法只踢掉某一台设备（只能改密码全清）。
--  - 旧代码 INSERT 同时写明文 token（033 过渡期双写）；S2 起只写 token_hash，
--    token 列收敛为**可空保留列**（DROP COLUMN 留到 S4 二次发布 —— 旧镜像还在写它，
--    先删列会让并发发布的旧实例 INSERT 失败）。
--
-- 为什么还要换主键
--  - 原主键是 token(text)，主键列无法 DROP NOT NULL；要让新代码 INSERT 不写 token，
--    必须把主键换成代理键：新增 id uuid（gen_random_uuid）作主键，token 退回可空普通列，
--    并用部分唯一索引保住旧镜像「同 token 重复插入」的报错语义。
--  - id 同时给 /api/auth/sessions 的设备管理（列表 / 吊销单个会话）提供稳定标识。
--  - 旧镜像兼容：它 INSERT 时仍写 token，id 由默认值补齐，不冲突。
--
-- 回滚：db/migrations/down/079_session_lifecycle.down.sql
-- ============================================================================

-- 1) 生命周期 / 设备信息三列（无默认值：避免 ALTER 时全表重写；旧行 NULL 由查询 COALESCE 处理）
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_label text;

-- 2) 代理主键列（幂等；gen_random_uuid 是 PG13+ 内置函数，078 已在用）
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF to_regclass('public.sessions') IS NULL THEN
    RETURN;
  END IF;

  -- 2a) 摘掉旧的 token 主键（每次执行先看是否还存在）
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sessions'::regclass AND conname = 'sessions_pkey'
  ) THEN
    ALTER TABLE sessions DROP CONSTRAINT sessions_pkey;
  END IF;

  -- 2b) 用代理 id 建主键（已存在则跳过）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sessions'::regclass AND conname = 'sessions_pkey'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
  END IF;

  -- 2c) token 收敛为可空（列本身保留，S4 再删）
  ALTER TABLE sessions ALTER COLUMN token DROP NOT NULL;

  -- 2d) 旧主键提供的 token 唯一性用部分唯一索引补上（NULL 允许多行）
  CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_token ON sessions (token) WHERE token IS NOT NULL;
END $$;

-- 3) 设备管理按用户列会话：user_id + 未过期（idx_sessions_user_id 已存在，补过期过滤用的组合索引）
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions (user_id, expires_at);
