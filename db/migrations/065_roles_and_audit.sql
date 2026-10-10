-- 065：角色模型与操作审计（组三 · 阶段 17 = V3 横轨 H3）
--
-- 现状（实测）：用户只有 `users.is_admin` 一个布尔；受限操作"谁做的、什么时候、对什么"没有留痕，
-- 出问题只能翻应用日志，且应用日志不落库、会被清理。
--
-- 本迁移做两件事：
--   1) users.role（learner / editor / reviewer / admin）：内容编辑、审核、管理员与学习者分开。
--      存量 is_admin=true 的用户回填成 admin；**保留 is_admin 字段**（旧脚本仍在读，不搞破坏性改名）。
--   2) audit_log：操作审计表。只追加（不给 UPDATE 触发器），字段够回答"谁 / 何时 / 对什么 / 结果"。
--
-- 幂等：ADD COLUMN IF NOT EXISTS / CREATE TABLE|INDEX IF NOT EXISTS / DO 块吞 duplicate_object；
--       db/schema.sql 已同步登记。回滚：down/065_roles_and_audit.down.sql（注意回填不可逆，见该文件说明）。

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'learner';

DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT ck_users_role
    CHECK (role IN ('learner','editor','reviewer','admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE users SET role = 'admin' WHERE is_admin = true AND role <> 'admin';

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,   -- 人没了审计还在（SET NULL 而不是 CASCADE）
  actor_type  text NOT NULL DEFAULT 'user',
              CONSTRAINT ck_audit_log_actor_type CHECK (actor_type IN ('user','system','cron','cli','anon')),
  action      text NOT NULL,                                   -- 形如 content.import / content.import.rollback
  target_type text,                                            -- 形如 content_source / knowledge_point
  target_id   text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,               -- 计数、dryRun、批次号等结构化上下文
  request_id  text,                                            -- 与响应体 / 日志对齐（H2 的 requestId）
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target  ON audit_log(target_type, target_id);
