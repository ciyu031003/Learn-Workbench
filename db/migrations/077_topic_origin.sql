-- 077：知识点来源标记（origin）—— 允许"直接在库里扩知识点"
--
-- 背景（2026-10-15 用户决策）：知识点要"全量增加"，一部分内容会**直接写进数据库**
-- （爬取/搜索后总结入库，或后台录入）。但同步的软归档逻辑会把"内容包里没有的行"标成
-- archived —— 那样库里新增的知识点下一次同步就没了。
--
-- 方案：给 learning_topics 加 origin（'package' | 'db'，默认 'package'）：
--   - 内容包同步写入的行 origin='package'，仍受软归档管辖；
--   - 库里新增的行 origin='db'，**同步永不归档**（只由人工/后台下架）。
--
-- 回滚：db/migrations/down/077_topic_origin.down.sql

ALTER TABLE learning_topics
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'package';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_learning_topics_origin'
  ) THEN
    ALTER TABLE learning_topics
      ADD CONSTRAINT ck_learning_topics_origin CHECK (origin IN ('package','db'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_learning_topics_origin ON learning_topics(origin);
