-- 061：阅读体验状态（组二 · 阶段 8 = V3 纵轨 Phase B）
--
-- 目的：让"读完"与"收藏"成为**可跨设备同步的用户状态**（此前只有本地 TS 里的勾选，
-- 阅读页打开过什么、读到哪、收藏了哪一节，服务端一无所知）。
-- 设计取舍：
--   - 不设 point_key → knowledge_points(key) 外键：**用户的学习痕迹优先于内容索引**。
--     内容侧同步失败/归档都不能让阅读记录写入失败（Phase E 的验收要求"题库更新不删除历史作答"）。
--     track/stage/topic 三段冗余存下来，便于与内容侧对账。
--   - 阅读进度只增不减（GREATEST），避免"回看前文"把进度打回去；重复读不降低 first_read_at。
--   - 收藏用软删除 + 部分唯一索引：同一知识点只允许一条"生效中"的收藏，取消后可再次收藏。
-- 幂等：IF NOT EXISTS + 部分唯一索引；db/schema.sql 已同步登记。

CREATE TABLE IF NOT EXISTS knowledge_read_state (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  point_key      text NOT NULL,             -- 知识点稳定 ID：<trackSlug>/<stageKey>/<topicKey>
  track_slug     text NOT NULL,
  stage_key      text NOT NULL,
  topic_key      text NOT NULL,
  first_read_at  timestamptz NOT NULL DEFAULT now(),
  last_read_at   timestamptz NOT NULL DEFAULT now(),
  progress       int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  read_count     int NOT NULL DEFAULT 1 CHECK (read_count >= 1),
  client_id      text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, point_key)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_read_recent
  ON knowledge_read_state(user_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_read_track
  ON knowledge_read_state(user_id, track_slug, stage_key);

CREATE TABLE IF NOT EXISTS knowledge_favorites (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  point_key  text NOT NULL,
  track_slug text NOT NULL,
  stage_key  text NOT NULL,
  topic_key  text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 同一知识点同时只能有一条"生效中"的收藏（取消后可重新收藏，历史行保留可审计）
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_favorites_active
  ON knowledge_favorites(user_id, point_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_favorites_recent
  ON knowledge_favorites(user_id, created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_knowledge_read_state_updated ON knowledge_read_state;
CREATE TRIGGER trg_knowledge_read_state_updated BEFORE UPDATE ON knowledge_read_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_knowledge_favorites_updated ON knowledge_favorites;
CREATE TRIGGER trg_knowledge_favorites_updated BEFORE UPDATE ON knowledge_favorites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
