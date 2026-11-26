-- 回滚 094：去掉匿名 clientId 唯一索引（已软删除的重复行不恢复）
DROP INDEX IF EXISTS uq_meal_entries_client_anon;
