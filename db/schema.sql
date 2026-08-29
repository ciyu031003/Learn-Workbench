-- ============================================================================
-- ICT 学习工作台 · 数据库 Schema
-- Database : Learn-Workbench
-- Engine   : PostgreSQL 18.4（项目本地集群 .pgdata）
-- 说明     : 内容数据 + 用户数据 + 背景图记录，P1 云同步复用同一结构（Supabase）
-- ============================================================================

-- ---------- 0. 内容数据（只读，seed 自 db/seed_content.sql） ----------

CREATE TABLE content_phases (
  id         serial PRIMARY KEY,
  phase_key  text NOT NULL UNIQUE,            -- 'phase-0' .. 'phase-6' / 'agent-track'
  career_key text NOT NULL DEFAULT 'ict',     -- 所属职业路线（见 careers 表）
  title      text NOT NULL,
  weeks      text,                            -- 如 '第 0-2 周'
  track      text NOT NULL DEFAULT 'main' CHECK (track IN ('main','agent')),
  summary    text,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (career_key, track, sort_order)
);

CREATE TABLE content_topics (
  id         serial PRIMARY KEY,
  phase_id   int NOT NULL REFERENCES content_phases(id) ON DELETE CASCADE,
  topic_key  text NOT NULL UNIQUE,
  title      text NOT NULL,
  summary    text,
  agent_task text,                            -- 该主题绑定的 Agent 副线任务
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE content_resources (
  id         serial PRIMARY KEY,
  topic_id   int NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  name       text NOT NULL,
  url        text,
  kind       text NOT NULL DEFAULT 'doc' CHECK (kind IN ('course','doc','tool','video')),
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE content_practices (
  id         serial PRIMARY KEY,
  topic_id   int NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  text       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE content_projects (
  id          serial PRIMARY KEY,
  topic_id    int NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  repo_url    text,
  deliverable text,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE content_checkpoints (
  id         serial PRIMARY KEY,
  topic_id   int NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  text       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

-- ---------- 0.1 职业路线（多职业学习路线，默认可自定义主题） ----------

CREATE TABLE careers (
  id          serial PRIMARY KEY,
  career_key  text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  is_locked   boolean NOT NULL DEFAULT false,   -- 职业路线是否锁定（默认均可自定义主题）
  sort_order  int NOT NULL DEFAULT 0
);

-- ---------- 1. 用户（P1 云同步启用；本地匿名模式 user_id 为 NULL） ----------

CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text UNIQUE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. 主题进度 ----------

CREATE TABLE topic_progress (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,   -- NULL = 本地匿名
  topic_id   int NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  done       boolean NOT NULL DEFAULT false,
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);

-- ---------- 3. 每日任务 ----------

CREATE TABLE daily_tasks (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  task_date     date NOT NULL,
  title         text NOT NULL,
  phase_id      int REFERENCES content_phases(id) ON DELETE SET NULL,
  topic_id      int REFERENCES content_topics(id) ON DELETE SET NULL,
  task_type     text NOT NULL DEFAULT 'study'
                CHECK (task_type IN ('study','agent','output','review','exam')),
  done          boolean NOT NULL DEFAULT false,
  focus_minutes int NOT NULL DEFAULT 0,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- 4. 专注会话 ----------

CREATE TABLE focus_sessions (
  id               bigserial PRIMARY KEY,
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  task_id          bigint REFERENCES daily_tasks(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  duration_seconds int,
  tag              text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------- 5. 打卡（连续打卡由 checkins 聚合计算） ----------

CREATE TABLE checkins (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

-- ---------- 6. XP 事件（轻量游戏化） ----------

CREATE TABLE xp_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  amount      int NOT NULL,
  reason      text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 7. 学习日志（费曼 / 复盘 / 项目 / 面试） ----------

CREATE TABLE log_entries (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('feynman','review','project','interview')),
  title      text NOT NULL,
  content    text NOT NULL,
  refs       jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 8. 证书 ----------

CREATE TABLE certificates (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,                  -- 'HCIP-Datacom' / '天翼云 ACP'
  target_date date,
  status      text NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned','preparing','achieved')),
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 9. 简历资产 / GitHub 项目卡片 ----------

CREATE TABLE resume_assets (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('project','skill','github','certificate')),
  title      text NOT NULL,
  content    text,
  url        text,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 10. 面试题库 ----------

CREATE TABLE interview_questions (
  id         bigserial PRIMARY KEY,
  module     text NOT NULL,                   -- '通信' | 'ETL' | 'Linux云运维' | 'Agent' | '行业'
  question   text NOT NULL,
  answer     text,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 11. 设置（键值，user_id 为 NULL 表示全局默认） ----------

CREATE TABLE settings (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- ---------- 12. 背景图记录（Bing 每日壁纸爬虫写入） ----------

CREATE TABLE background_images (
  id         bigserial PRIMARY KEY,
  source     text NOT NULL DEFAULT 'bing',
  image_date date NOT NULL,
  file_name  text NOT NULL,
  remote_url text,
  local_path text,
  width      int,
  height     int,
  md5_hash   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, image_date)
);

-- ---------- 13. 应用元信息（schema 版本等） ----------

CREATE TABLE app_meta (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 索引 ----------

CREATE INDEX idx_topics_phase      ON content_topics(phase_id);
CREATE INDEX idx_phases_career     ON content_phases(career_key);
CREATE INDEX idx_resources_topic   ON content_resources(topic_id);
CREATE INDEX idx_practices_topic   ON content_practices(topic_id);
CREATE INDEX idx_projects_topic    ON content_projects(topic_id);
CREATE INDEX idx_checkpoints_topic ON content_checkpoints(topic_id);
CREATE INDEX idx_progress_user     ON topic_progress(user_id);
CREATE INDEX idx_progress_topic    ON topic_progress(topic_id);
CREATE INDEX idx_tasks_date        ON daily_tasks(task_date);
CREATE INDEX idx_tasks_user        ON daily_tasks(user_id);
CREATE INDEX idx_sessions_user     ON focus_sessions(user_id);
CREATE INDEX idx_sessions_start    ON focus_sessions(started_at);
CREATE INDEX idx_checkins_user_date ON checkins(user_id, checkin_date);
CREATE INDEX idx_xp_user           ON xp_events(user_id);
CREATE INDEX idx_logs_user         ON log_entries(user_id);
CREATE INDEX idx_certs_user        ON certificates(user_id);
CREATE INDEX idx_resume_user       ON resume_assets(user_id);
CREATE INDEX idx_questions_module  ON interview_questions(module);
CREATE INDEX idx_bg_date           ON background_images(image_date);


-- 匿名模式唯一索引（本地无登录模式）
CREATE UNIQUE INDEX uq_topic_progress_anon ON topic_progress(topic_id) WHERE user_id IS NULL;
CREATE UNIQUE INDEX uq_topic_progress_user ON topic_progress(user_id, topic_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_checkins_anon ON checkins(checkin_date) WHERE user_id IS NULL;
CREATE UNIQUE INDEX uq_checkins_user ON checkins(user_id, checkin_date) WHERE user_id IS NOT NULL;

-- ---------- 14. 账号与会话（登录认证） ----------

CREATE TABLE accounts (
  id            serial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- ---------- updated_at 自动更新 ----------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 自定义主题标记
ALTER TABLE content_topics ADD COLUMN is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE content_topics ADD COLUMN owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_topics_owner ON content_topics(owner_id);

CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_topic_progress_updated BEFORE UPDATE ON topic_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_daily_tasks_updated  BEFORE UPDATE ON daily_tasks    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_log_entries_updated  BEFORE UPDATE ON log_entries    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_certificates_updated BEFORE UPDATE ON certificates   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_resume_assets_updated BEFORE UPDATE ON resume_assets  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated     BEFORE UPDATE ON settings       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_app_meta_updated     BEFORE UPDATE ON app_meta       FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- 15. Knowledge Domain（§11-§18：学习知识库） ----------

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  topic_id     int REFERENCES content_topics(id) ON DELETE SET NULL,
  title        text NOT NULL,
  slug         text NOT NULL,
  content      text NOT NULL,
  summary      text,
  type         text NOT NULL DEFAULT 'NOTE'
               CHECK (type IN ('NOTE','TUTORIAL','REFERENCE','MINDMAP','REVIEW','PROJECT_NOTE')),
  status       text NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  source       text,           -- 来源标识（travel-notes / manual / ...）
  source_path  text,           -- 原始来源路径
  source_id    text,           -- 原始来源 ID（可追溯）
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_notes_user ON knowledge_notes(user_id, slug) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_notes_anon ON knowledge_notes(slug) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_type  ON knowledge_notes(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_topic ON knowledge_notes(topic_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_user  ON knowledge_notes(user_id);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_tags_user ON knowledge_tags(user_id, slug) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_tags_anon ON knowledge_tags(slug) WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_note_tags (
  note_id bigint NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  tag_id  bigint NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS knowledge_links (
  id             bigserial PRIMARY KEY,
  source_note_id bigint NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  target_note_id bigint NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  type           text NOT NULL DEFAULT 'RELATED'
                 CHECK (type IN ('RELATED','PREREQUISITE','REFERENCE','DERIVED')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (source_note_id <> target_note_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_links_source ON knowledge_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_target ON knowledge_links(target_note_id);

DROP TRIGGER IF EXISTS trg_knowledge_notes_updated ON knowledge_notes;
CREATE TRIGGER trg_knowledge_notes_updated
  BEFORE UPDATE ON knowledge_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- 16. 增量同步（§37-§40：sync_devices / sync_changes / 软删除） ----------

ALTER TABLE topic_progress  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE daily_tasks     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE focus_sessions  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE checkins        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE log_entries     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE resume_assets   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE content_topics  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE knowledge_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE checkins       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_focus_sessions_updated ON focus_sessions;
CREATE TRIGGER trg_focus_sessions_updated BEFORE UPDATE ON focus_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_checkins_updated ON checkins;
CREATE TRIGGER trg_checkins_updated BEFORE UPDATE ON checkins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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


-- ============================================================================
-- 2.x 增量迁移建表登记（全量对账补齐，2026-08-24）
-- 以下表由 db/migrations/003~017 增量迁移创建；此处按迁移顺序原样提取，使
-- db/schema.sql 成为完整表清单（scripts/verify-migrations.mjs 校验通过）。
-- 说明：索引 / 触发器 / 约束补充语句仍保留在对应迁移文件中，全新部署由
--       schema.sql + 全部迁移共同建库（建表均为 IF NOT EXISTS，幂等）。
-- ============================================================================

-- 来自迁移 006_wellbeing.sql
CREATE TABLE IF NOT EXISTS wellbeing_reminders (
  id                bigserial PRIMARY KEY,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  type              text NOT NULL DEFAULT 'CUSTOM' CHECK (type IN ('HYDRATION','STAND','BREAK','MOVEMENT','SLEEP','CUSTOM')),
  title             text NOT NULL,
  message           text,
  enabled           boolean NOT NULL DEFAULT true,
  interval_minutes  int  NOT NULL DEFAULT 60 CHECK (interval_minutes BETWEEN 1 AND 1440),
  start_time        text NOT NULL DEFAULT '09:00',
  end_time          text NOT NULL DEFAULT '22:00',
  weekdays          int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  last_triggered_at timestamptz,
  next_trigger_at   timestamptz,
  deleted_at        timestamptz,
  client_id         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 006_wellbeing.sql
CREATE TABLE IF NOT EXISTS hydration_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  amount_ml   int NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 2000),
  source      text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','REMINDER','FOCUS_BREAK')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  client_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 006_wellbeing.sql
CREATE TABLE IF NOT EXISTS hydration_goals (
  id             bigserial PRIMARY KEY,
  user_id        uuid REFERENCES users(id) ON DELETE CASCADE,
  target_ml      int NOT NULL DEFAULT 2000 CHECK (target_ml BETWEEN 200 AND 10000),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 006_wellbeing.sql
CREATE TABLE IF NOT EXISTS energy_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  level       int NOT NULL CHECK (level BETWEEN 1 AND 5),
  note        text,
  source      text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','AFTER_FOCUS','MORNING')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  client_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 006_wellbeing.sql
CREATE TABLE IF NOT EXISTS break_sessions (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'SHORT' CHECK (kind IN ('SHORT','LONG','MOVEMENT','EYE_REST','MEAL')),
  minutes    int NOT NULL DEFAULT 5 CHECK (minutes BETWEEN 1 AND 240),
  note       text,
  started_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  client_id  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 007_jobs.sql
CREATE TABLE IF NOT EXISTS job_crawler_configs (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  keywords      jsonb NOT NULL DEFAULT '[]',
  industries    jsonb NOT NULL DEFAULT '[]',
  cities        jsonb NOT NULL DEFAULT '[]',
  platforms     jsonb NOT NULL DEFAULT '["lagou","liepin","zhilian","job51"]',
  schedule_time text   NOT NULL DEFAULT '08:00',
  enabled       boolean NOT NULL DEFAULT true,
  max_pages     int    NOT NULL DEFAULT 3,
  last_run_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 007_jobs.sql
CREATE TABLE IF NOT EXISTS job_postings (
  id            bigserial PRIMARY KEY,
  source        text NOT NULL,          -- lagou / liepin / zhilian / job51 / boss
  source_job_id text NOT NULL,          -- 源站职位 ID
  title         text NOT NULL,
  company       text NOT NULL DEFAULT '',
  city          text NOT NULL DEFAULT '',
  district      text NOT NULL DEFAULT '',
  salary_min    int,
  salary_max    int,
  salary_text   text NOT NULL DEFAULT '',
  experience    text NOT NULL DEFAULT '',
  education     text NOT NULL DEFAULT '',
  tags          jsonb NOT NULL DEFAULT '[]',
  description   text NOT NULL DEFAULT '',
  requirements  text NOT NULL DEFAULT '',
  company_info  text NOT NULL DEFAULT '',
  url           text NOT NULL,
  logo_url      text NOT NULL DEFAULT '',
  published_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (source, source_job_id)
);

-- 来自迁移 007_jobs.sql
CREATE TABLE IF NOT EXISTS job_favorites (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

-- 来自迁移 007_jobs.sql
CREATE TABLE IF NOT EXISTS job_crawler_runs (
  id               bigserial PRIMARY KEY,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  status           text NOT NULL DEFAULT 'running',   -- running / success / partial / failed
  config_snapshot  jsonb,
  platforms_result jsonb NOT NULL DEFAULT '{}',
  fetched_count    int NOT NULL DEFAULT 0,
  new_count        int NOT NULL DEFAULT 0,
  error            text
);

-- 来自迁移 009_job_sources.sql
CREATE TABLE IF NOT EXISTS job_crawler_sources (
  id               text PRIMARY KEY,          -- 与 hosts 文件 id 一致
  category         text NOT NULL,             -- internet / gongkao / gongbian / yangqi
  channel          text NOT NULL DEFAULT 'announcement', -- job / announcement / event
  name             text NOT NULL,
  engine           text NOT NULL DEFAULT 'http',  -- http / browser
  base_url         text NOT NULL DEFAULT '',
  list_config      jsonb NOT NULL DEFAULT '{}',   -- list/pagination/selectors
  detail_config    jsonb NOT NULL DEFAULT '{}',
  deadline_parse   boolean NOT NULL DEFAULT false,
  rate_limit_ms    int NOT NULL DEFAULT 3000,
  max_items_per_run int NOT NULL DEFAULT 20,
  max_pages        int NOT NULL DEFAULT 1,
  risk             text NOT NULL DEFAULT 'L1',
  enabled          boolean NOT NULL DEFAULT true,
  hit_rate         numeric(4,3) NOT NULL DEFAULT 1,
  last_run_at      timestamptz,
  last_error       text NOT NULL DEFAULT '',
  note             text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 009_job_sources.sql
CREATE TABLE IF NOT EXISTS job_source_health (
  id         bigserial PRIMARY KEY,
  source     text NOT NULL REFERENCES job_crawler_sources(id) ON DELETE CASCADE,
  run_id     bigint,
  fetched    int NOT NULL DEFAULT 0,
  hit_rate   numeric(4,3) NOT NULL DEFAULT 0,
  error      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 011_job_engagement.sql
CREATE TABLE IF NOT EXISTS job_subscriptions (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  categories jsonb NOT NULL DEFAULT '[]',   -- 订阅的分类
  keywords   jsonb NOT NULL DEFAULT '[]',   -- 关键词（标题/公司/岗位表岗位名）
  cities     jsonb NOT NULL DEFAULT '[]',   -- 城市/地区
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 011_job_engagement.sql
CREATE TABLE IF NOT EXISTS job_notifications (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  subscription_id bigint REFERENCES job_subscriptions(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text NOT NULL DEFAULT '',
  url             text NOT NULL DEFAULT '',
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 011_job_engagement.sql
CREATE TABLE IF NOT EXISTS job_exam_events (
  id         bigserial PRIMARY KEY,
  job_id     bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  source     text NOT NULL,
  kind       text NOT NULL,                 -- apply_start / apply_end / exam / interview / result
  label      text NOT NULL,                 -- 报名开始 / 报名截止 / 笔试 / 面试 / 成绩公布
  event_at   timestamptz NOT NULL,
  note       text NOT NULL DEFAULT '',
  UNIQUE (job_id, kind, event_at)
);

-- 来自迁移 013_job_clusters.sql
CREATE TABLE IF NOT EXISTS job_clusters (
  id               bigserial PRIMARY KEY,
  canonical_title  text NOT NULL,           -- 规范化职位名
  canonical_company text NOT NULL,          -- 规范化公司名
  city             text NOT NULL DEFAULT '',-- 城市
  dedup_key        text NOT NULL,           -- normalize(title)|normalize(company)|city（唯一键）
  job_ids          bigint[] NOT NULL DEFAULT '{}',   -- 簇内成员职位 id
  source_list      jsonb NOT NULL DEFAULT '[]',      -- 发现来源（如 ["boss","liepin","zhilian"]）
  primary_job_id   bigint,                  -- 代表职位（最新抓取的一个）
  member_count     int NOT NULL DEFAULT 1,  -- 簇内职位数
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedup_key)
);

-- 来自迁移 014_skill_taxonomy.sql
CREATE TABLE IF NOT EXISTS skill_taxonomy (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL UNIQUE,           -- 规范名，如 redis
  aliases    jsonb NOT NULL DEFAULT '[]',    -- 别名（归一化匹配用）
  category   text NOT NULL DEFAULT '',       -- backend/frontend/ops/ai/data/network/security/cloud/soft
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 014_skill_taxonomy.sql
CREATE TABLE IF NOT EXISTS user_skills (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id   bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  level      int NOT NULL DEFAULT 2,         -- 0-5（0=不会 1=了解 2=入门 3=熟练 4=精通 5=专家）
  source     text NOT NULL DEFAULT 'manual', -- manual / resume / topic / gap
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

-- 来自迁移 014_skill_taxonomy.sql
CREATE TABLE IF NOT EXISTS job_skill_links (
  job_id   bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  weight   numeric(3,2) NOT NULL DEFAULT 1,  -- 岗位对该技能的权重（默认 1）
  PRIMARY KEY (job_id, skill_id)
);

-- 来自迁移 014_skill_taxonomy.sql
CREATE TABLE IF NOT EXISTS skill_content_links (
  skill_id       bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  topic_id       bigint NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  estimate_hours int NOT NULL DEFAULT 8,     -- 预计学习时长（小时）
  PRIMARY KEY (skill_id, topic_id)
);

-- 来自迁移 015_job_applications.sql
CREATE TABLE IF NOT EXISTS job_applications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  stage      text NOT NULL DEFAULT 'favorite'
             CHECK (stage IN ('favorite','ready','applied','online_test','interview1','interview2','offer','hired','closed')),
  note       text NOT NULL DEFAULT '',
  applied_at timestamptz,                       -- 投递时间
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

-- 来自迁移 016_security_hardening.sql
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         bigserial PRIMARY KEY,
  username   text NOT NULL DEFAULT '',
  ip         text NOT NULL DEFAULT '',
  success    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 016_security_hardening.sql
CREATE TABLE IF NOT EXISTS task_runs (
  id          bigserial PRIMARY KEY,
  task_key    text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'idle'
              CHECK (status IN ('idle','running','finished','failed')),
  started_by  text,
  pid         int,
  started_at  timestamptz,
  finished_at timestamptz,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 017_market_stats.sql
CREATE TABLE IF NOT EXISTS market_stats (
  key         text PRIMARY KEY,
  payload     jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- 来自迁移 021_interview_attempts.sql
CREATE TABLE IF NOT EXISTS interview_attempts (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id    bigint REFERENCES interview_questions(id) ON DELETE SET NULL,
  application_id bigint REFERENCES job_applications(id) ON DELETE SET NULL,
  phase_id       int REFERENCES content_phases(id) ON DELETE SET NULL,
  mode           text NOT NULL DEFAULT 'quiz'
                 CHECK (mode IN ('quiz','mock','interview')),
  self_rating    int CHECK (self_rating IS NULL OR (self_rating >= 1 AND self_rating <= 5)),
  reaction       int,
  chosen_answer  text NOT NULL DEFAULT '',
  is_correct     boolean,
  note           text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_attempt_user ON interview_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempt_question ON interview_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempt_application ON interview_attempts(application_id);
