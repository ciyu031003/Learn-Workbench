-- 094: 匿名饮食条目的 clientId 唯一（防并发补发重复落库）
--
-- 背景（v2.8.7 真机）：饮食页 mount / 回前台 / 下拉刷新会并发触发多次 load()，
-- 每次都先补发同一个离线发件箱操作。匿名写入过去只有应用层 SELECT 幂等检查，
-- 两个请求同时通过检查后各 INSERT 一次，结果同一顿饭出现两条。
--
-- 先清理历史重复（同一 anon_id + client_id 仅保留 id 最小的一条），再加部分唯一索引。
-- 幂等：可重复执行。

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY anon_id, client_id ORDER BY id) AS rn
    FROM meal_entries
   WHERE user_id IS NULL
     AND anon_id IS NOT NULL
     AND client_id IS NOT NULL
     AND deleted_at IS NULL
)
UPDATE meal_entries m
   SET deleted_at = now()
  FROM ranked r
 WHERE m.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_entries_client_anon
  ON meal_entries(anon_id, client_id)
  WHERE user_id IS NULL AND anon_id IS NOT NULL AND client_id IS NOT NULL AND deleted_at IS NULL;
