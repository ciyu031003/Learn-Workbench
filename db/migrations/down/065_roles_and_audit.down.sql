-- 065 回滚：角色模型与操作审计
--
-- 可回滚：audit_log 表、users.role 列与 CHECK 约束。
-- **不可回滚**（故意不写）：
--   - `UPDATE users SET role='admin' WHERE is_admin` 的回填无法还原（原值就是 is_admin，无需还原）；
--   - 审计记录一旦写入就不该被回滚删除（DROP TABLE 会连数据一起丢，这是回滚的代价，必须知情）。
-- migrate-drill 只断言对象消失，不做数据还原验证。

DROP TABLE IF EXISTS audit_log;

ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role;
ALTER TABLE users DROP COLUMN IF EXISTS role;
