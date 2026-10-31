-- ============================================================================
-- 083_sync_ledger_triggers.sql —— sync ledger 触发器：所有写路径自动进 sync_changes
-- （评审 2026-10-31 · 同步协议 v2.1）
--
-- 背景
--  - 此前 sync_changes 只由 push 路由（recordSyncChanges）写入，web 端直写业务表
--    不会进 ledger；pull 因此只能按实体表 updated_at > since 过滤。
--  - 该过滤有两个丢数据缺陷（docs/全面评审报告-2026-10-31.md P0/P1）：
--      a) 设备离线补传的旧时间戳变更，对游标已越过该时刻的其他设备永久不可见；
--      b) 分页 offset 在集合变动时跳条/重复。
--  - 081 已给 sync_changes 建好全局单调 seq。本迁移让 11 张同步实体表的所有
--    INSERT/UPDATE/DELETE 经触发器自动写入 ledger，pull（v2 游标）改为
--    `WHERE seq > cursor ORDER BY seq LIMIT n` 的单表顺序回放：
--    写入顺序即到达顺序，与业务时间戳解耦，P0/P1/P2 一并消除。
--
-- 口径（与 collectChangesSince 逐一对齐，apps/web/lib/sync-service.ts）
--  - entity_id：client_id 优先，缺省 'srv-'||id；progress=topic_id、
--    checkins=checkin_date、habitLogs='<habit.client_id>|<log_date>'；
--  - habit_logs：habit 未带 client_id 的打卡不入 ledger（与 collect 的 JOIN 条件一致）；
--  - resume_assets 只记 kind='github'；content_topics 只记自定义主题（is_custom + owner_id）；
--  - 软删除（deleted_at 非空）在 TS 映射层（ledgerRowToChange）转 DELETE，触发器原样存行；
--  - created_at 取业务行 updated_at（作为变更的 updatedAt 供 LWW），synced_at=now()；
--  - 匿名行（user_id/owner_id 为空）不入 ledger（生产事故 2026-10-31：exercise_logs
--    存量匿名行令回填撞 NOT NULL，init 容器 exit 3，迁移整体回滚）。
--
-- 双记抑制
--  - push 事务内应用层已自行 recordSyncChanges（带 change_id 供幂等去重），
--    路由在 BEGIN 后 `SET LOCAL app.sync_ledger = 'off'`，触发器检测到即让路。
--
-- 幂等：函数 CREATE OR REPLACE；触发器先 DROP IF EXISTS（schema.sql 同构，空库跑
-- schema.sql 后再跑本迁移不冲突）。回滚：db/migrations/down/083_sync_ledger_triggers.down.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sync_changes_capture() RETURNS trigger AS $$
DECLARE
  v_row  jsonb;
  v_type text;
  v_eid  text;
  v_hcid text;
BEGIN
  -- push 事务内由应用层自行写 ledger（recordSyncChanges，带 change_id 幂等），触发器让路
  IF current_setting('app.sync_ledger', true) = 'off' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  -- 匿名行（user_id/owner_id 均为空）不入 ledger：同步只服务登录用户，
  -- 且 sync_changes.user_id 非空约束也不允许。匿名数据的可见性由各业务表自身管理。
  -- 生产事故记录（2026-10-31）：exercise_logs 等表存在匿名行，缺失此检查时
  -- 运行期任何匿名写入都会令触发器撞 NOT NULL 约束。
  IF COALESCE(NULLIF(v_row->>'user_id', ''), v_row->>'owner_id') IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'topic_progress' THEN
      v_type := 'progress';
      v_eid  := v_row->>'topic_id';
    WHEN 'daily_tasks' THEN
      v_type := 'tasks';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'focus_sessions' THEN
      v_type := 'sessions';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'checkins' THEN
      v_type := 'checkins';
      v_eid  := v_row->>'checkin_date';
    WHEN 'log_entries' THEN
      v_type := 'logs';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'resume_assets' THEN
      IF COALESCE(v_row->>'kind', '') <> 'github' THEN RETURN COALESCE(NEW, OLD); END IF;
      v_type := 'github';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'content_topics' THEN
      -- 只记自定义主题（与 collect 的 owner_id + is_custom 条件一致；owner_id 即同步归属用户）
      IF COALESCE(v_row->>'is_custom', '') <> 'true' OR v_row->>'owner_id' IS NULL THEN
        RETURN COALESCE(NEW, OLD);
      END IF;
      v_type := 'customTopics';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'exercise_logs' THEN
      v_type := 'exerciseLogs';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'certificates' THEN
      v_type := 'certificates';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'habits' THEN
      v_type := 'habits';
      v_eid  := COALESCE(NULLIF(v_row->>'client_id', ''), 'srv-' || (v_row->>'id'));
    WHEN 'habit_logs' THEN
      -- 打卡寻址依赖习惯的 client_id；未回填的习惯不入 ledger（与 collect 的 JOIN 条件一致）
      SELECT h.client_id INTO v_hcid FROM habits h WHERE h.id = (v_row->>'habit_id')::bigint;
      IF v_hcid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
      v_type := 'habitLogs';
      v_eid  := v_hcid || '|' || left(COALESCE(v_row->>'log_date', ''), 10);
    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  INSERT INTO sync_changes
    (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
  VALUES
    ( COALESCE(NULLIF(v_row->>'user_id', ''), v_row->>'owner_id')::uuid
    , 'web'
    , v_type
    , v_eid
    , CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'UPDATE' THEN 'UPDATE' ELSE 'DELETE' END
    , 1
    , v_row
    , COALESCE((v_row->>'updated_at')::timestamptz, now())
    , now()
    );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ledger_topic_progress ON topic_progress;
CREATE TRIGGER trg_sync_ledger_topic_progress
  AFTER INSERT OR UPDATE OR DELETE ON topic_progress
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_daily_tasks ON daily_tasks;
CREATE TRIGGER trg_sync_ledger_daily_tasks
  AFTER INSERT OR UPDATE OR DELETE ON daily_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_focus_sessions ON focus_sessions;
CREATE TRIGGER trg_sync_ledger_focus_sessions
  AFTER INSERT OR UPDATE OR DELETE ON focus_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_checkins ON checkins;
CREATE TRIGGER trg_sync_ledger_checkins
  AFTER INSERT OR UPDATE OR DELETE ON checkins
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_log_entries ON log_entries;
CREATE TRIGGER trg_sync_ledger_log_entries
  AFTER INSERT OR UPDATE OR DELETE ON log_entries
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_resume_assets ON resume_assets;
CREATE TRIGGER trg_sync_ledger_resume_assets
  AFTER INSERT OR UPDATE OR DELETE ON resume_assets
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_content_topics ON content_topics;
CREATE TRIGGER trg_sync_ledger_content_topics
  AFTER INSERT OR UPDATE OR DELETE ON content_topics
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_exercise_logs ON exercise_logs;
CREATE TRIGGER trg_sync_ledger_exercise_logs
  AFTER INSERT OR UPDATE OR DELETE ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_certificates ON certificates;
CREATE TRIGGER trg_sync_ledger_certificates
  AFTER INSERT OR UPDATE OR DELETE ON certificates
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_habits ON habits;
CREATE TRIGGER trg_sync_ledger_habits
  AFTER INSERT OR UPDATE OR DELETE ON habits
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

DROP TRIGGER IF EXISTS trg_sync_ledger_habit_logs ON habit_logs;
CREATE TRIGGER trg_sync_ledger_habit_logs
  AFTER INSERT OR UPDATE OR DELETE ON habit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_sync_changes_capture();

-- ============================================================================
-- 存量回填：083 之前 web 端直写的历史不入 ledger（触发器只覆盖此后），一次性把
-- 11 张实体表的当前状态灌入 sync_changes，保证 v2 拉取对全新设备/升级设备都完整。
--  - payload = to_jsonb(整行)（snake_case，与触发器行同构，ledgerRowToChange 统一映射）；
--  - operation 恒 'UPDATE'：软删行由 TS 层按 payload.deleted_at 转 DELETE（与 collect 口径一致）；
--  - 空库（schema.sql 建库流程）下这些 SELECT 天然无行，等价 no-op。
-- ============================================================================
INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'progress', topic_id::text, 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM topic_progress t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'tasks', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM daily_tasks t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'sessions', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM focus_sessions t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'checkins', checkin_date::text, 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM checkins t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'logs', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM log_entries t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'github', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM resume_assets t WHERE kind = 'github' AND t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT owner_id, 'web', 'customTopics', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM content_topics t WHERE is_custom IS TRUE AND owner_id IS NOT NULL AND t.owner_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'exerciseLogs', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM exercise_logs t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'certificates', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM certificates t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT user_id, 'web', 'habits', COALESCE(NULLIF(client_id, ''), 'srv-' || id), 'UPDATE', 1, to_jsonb(t.*), updated_at, now()
FROM habits t WHERE t.user_id IS NOT NULL;

INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, version, payload, created_at, synced_at)
SELECT l.user_id, 'web', 'habitLogs', h.client_id || '|' || left(l.log_date::text, 10), 'UPDATE', 1, to_jsonb(l.*), l.updated_at, now()
FROM habit_logs l JOIN habits h ON h.id = l.habit_id
WHERE h.client_id IS NOT NULL AND l.user_id IS NOT NULL;
