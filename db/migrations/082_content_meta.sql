-- ============================================================================
-- 082_content_meta.sql —— 内容版本 marker（S7-4b，幂等）
--
-- 背景：DB 是内容唯一事实源后，需要回答「DB 里的内容是哪次内容包同步来的」。
-- 此前 marker 散落在 learning_*.content_version（075 同步写）与 content_topics.content_version
-- （一直 unknown），没有统一位置；content-freshness 门禁因此只能判 UNKNOWN。
--
-- 方案：新增 content_meta(key/value/updated_at) 单行键值表：
--   content_version     最近一次同步的内容包版本（与 sync-content-model.mjs 同语义的 git short sha；
--                       无 git 时为仓库指纹前 12 位）
--   content_fingerprint 最近一次同步时仓库内容包指纹（sha256，scripts/lib/content-freshness.mjs）
--   content_synced_at  最近一次内容同步时间（ISO）
-- 写入点：apps/web/lib/content/learning-content-sync.ts（同步事务内 upsert）；
-- 读取点：scripts/content-freshness.mjs（优先级最高）。
--
-- 回滚：db/migrations/down/082_content_meta.down.sql（为 migration-drill 保留可解析的约束 drop）
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_meta (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE content_meta IS '内容包同步版本 marker（S7-4b；content-freshness 门禁读取）';

-- 幂等回填：从既有内容版本列取一个可用的最大版本，写 content_version（无内容/已有 marker 时跳过）
DO $$
DECLARE
  candidate text;
BEGIN
  IF to_regclass('public.content_meta') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM content_meta WHERE key = 'content_version') THEN
    RETURN;
  END IF;

  IF to_regclass('public.learning_tracks') IS NOT NULL THEN
    SELECT max(content_version) INTO candidate
      FROM learning_tracks
     WHERE content_version IS NOT NULL
       AND btrim(content_version) <> ''
       AND content_version <> 'unknown';
  END IF;

  IF candidate IS NULL AND to_regclass('public.content_topics') IS NOT NULL THEN
    SELECT max(content_version) INTO candidate
      FROM content_topics
     WHERE content_version IS NOT NULL
       AND btrim(content_version) <> ''
       AND content_version <> 'unknown';
  END IF;

  IF candidate IS NOT NULL THEN
    INSERT INTO content_meta (key, value) VALUES ('content_version', candidate)
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;
