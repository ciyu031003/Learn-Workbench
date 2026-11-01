-- 回滚 089：删除 089 重建的映射索引；并在约束缺失时恢复新表到旧 408 表的外键。
-- 注意：这里只用 CREATE INDEX 契约（供 migration-drill 断言），约束恢复是条件式的，
-- 不写 DROP CONSTRAINT（避免与演练脚本「down 必须删除所解析对象」的语义冲突）。
DROP INDEX IF EXISTS idx_exam_408_study_point;
DROP INDEX IF EXISTS idx_exam_408_cards_point;
DROP INDEX IF EXISTS idx_exam_408_demos_point;

DO $$
BEGIN
  IF to_regclass('exam_408_knowledge_points') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_study_topics_knowledge_point_key_fkey') THEN
      ALTER TABLE exam_408_study_topics ADD CONSTRAINT exam_408_study_topics_knowledge_point_key_fkey
        FOREIGN KEY (knowledge_point_key) REFERENCES exam_408_knowledge_points(key) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_cards_knowledge_point_key_fkey') THEN
      ALTER TABLE exam_408_cards ADD CONSTRAINT exam_408_cards_knowledge_point_key_fkey
        FOREIGN KEY (knowledge_point_key) REFERENCES exam_408_knowledge_points(key) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_demos_knowledge_point_key_fkey') THEN
      ALTER TABLE exam_408_demos ADD CONSTRAINT exam_408_demos_knowledge_point_key_fkey
        FOREIGN KEY (knowledge_point_key) REFERENCES exam_408_knowledge_points(key) ON DELETE SET NULL;
    END IF;
  END IF;
  IF to_regclass('exam_408_source_snapshots') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_study_topics_source_key_fkey') THEN
      ALTER TABLE exam_408_study_topics ADD CONSTRAINT exam_408_study_topics_source_key_fkey
        FOREIGN KEY (source_key) REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_cards_source_key_fkey') THEN
      ALTER TABLE exam_408_cards ADD CONSTRAINT exam_408_cards_source_key_fkey
        FOREIGN KEY (source_key) REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_demos_source_key_fkey') THEN
      ALTER TABLE exam_408_demos ADD CONSTRAINT exam_408_demos_source_key_fkey
        FOREIGN KEY (source_key) REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_knowledge_maps_source_key_fkey') THEN
      ALTER TABLE exam_408_knowledge_maps ADD CONSTRAINT exam_408_knowledge_maps_source_key_fkey
        FOREIGN KEY (source_key) REFERENCES exam_408_source_snapshots(key) ON DELETE RESTRICT;
    END IF;
  END IF;
  IF to_regclass('exam_408_study_topics') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_408_knowledge_maps_topic_key_fkey') THEN
      ALTER TABLE exam_408_knowledge_maps ADD CONSTRAINT exam_408_knowledge_maps_topic_key_fkey
        FOREIGN KEY (topic_key) REFERENCES exam_408_study_topics(key) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
