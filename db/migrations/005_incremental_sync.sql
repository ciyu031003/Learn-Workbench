-- ============================================================================
-- 005：增量同步（方案 §37-§40）
-- 核心同步实体增加 deleted_at（软删除）；focus_sessions/checkins 补 updated_at（增量游标 + LWW）；
-- 代理键实体增加 client_id（跨设备稳定 ID）；新增 sync_devices、sync_changes。
-- 冲突策略（§40）：第一阶段 Last-Write-Wins（按 updated_at）。
-- ============================================================================

-- 1) 软删除列
ALTER TABLE topic_progress  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE daily_tasks     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE focus_sessions  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE checkins        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE log_entries     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE resume_assets   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE content_topics  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE knowledge_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2) focus_sessions / checkins 补 updated_at + 触发器
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE checkins       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_focus_sessions_updated ON focus_sessions;
CREATE TRIGGER trg_focus_sessions_updated BEFORE UPDATE ON focus_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_checkins_updated ON checkins;
CREATE TRIGGER trg_checkins_updated BEFORE UPDATE ON checkins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) client_id（跨设备稳定 ID，增量合并的关键）
ALTER TABLE daily_tasks    ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE log_entries    ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE resume_assets  ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS client_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_tasks_client    ON daily_tasks(user_id, client_id)    WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_focus_sessions_client ON focus_sessions(user_id, client_id) WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_log_entries_client    ON log_entries(user_id, client_id)    WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_resume_assets_client  ON resume_assets(user_id, client_id)  WHERE user_id IS NOT NULL AND client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_topics_client ON content_topics(owner_id, client_id) WHERE owner_id IS NOT NULL AND client_id IS NOT NULL;

-- 4) sync_devices（§37 deviceId）
CREATE TABLE IF NOT EXISTS sync_devices (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    text NOT NULL,
  name         text,
  last_sync_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_sync_devices_user ON sync_devices(user_id);

-- 5) sync_changes（变更日志，§38）
CREATE TABLE IF NOT EXISTS sync_changes (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   text,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  operation   text NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE')),
  version     bigint NOT NULL DEFAULT 1,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  synced_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sync_changes_user   ON sync_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_changes_synced ON sync_changes(synced_at);

-- 6) 存量数据回填 client_id（'srv-' + id），保证旧行可被增量同步识别
UPDATE daily_tasks    SET client_id = 'srv-' || id WHERE client_id IS NULL;
UPDATE focus_sessions SET client_id = 'srv-' || id WHERE client_id IS NULL;
UPDATE log_entries    SET client_id = 'srv-' || id WHERE client_id IS NULL;
UPDATE resume_assets  SET client_id = 'srv-' || id WHERE client_id IS NULL;
UPDATE content_topics SET client_id = 'srv-' || id WHERE client_id IS NULL AND is_custom = TRUE;

-- 7) content_topics 补充 updated_at（同步游标/LWW 需要）
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_content_topics_updated ON content_topics;
CREATE TRIGGER trg_content_topics_updated BEFORE UPDATE ON content_topics FOR EACH ROW EXECUTE FUNCTION set_updated_at();
