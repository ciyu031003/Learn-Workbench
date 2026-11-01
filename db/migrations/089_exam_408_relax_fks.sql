-- 089: 解除 085-088 新表对旧 408 表的外键，保证 071 等旧迁移的 down 可执行（回滚演练契约）
-- 背景：exam_408_study_topics / cards / demos / knowledge_maps 通过外键引用
--       exam_408_knowledge_points / exam_408_source_snapshots / exam_408_study_topics；
--       旧迁移（如 071）的 down 直接 DROP 这些表时会被外键阻塞（migration-drill 失败）。
--       这些列仅作业务软关联（映射由 map-points.mjs 维护），不依赖数据库级联约束。
ALTER TABLE exam_408_study_topics DROP CONSTRAINT IF EXISTS exam_408_study_topics_knowledge_point_key_fkey;
ALTER TABLE exam_408_study_topics DROP CONSTRAINT IF EXISTS exam_408_study_topics_source_key_fkey;
ALTER TABLE exam_408_cards DROP CONSTRAINT IF EXISTS exam_408_cards_knowledge_point_key_fkey;
ALTER TABLE exam_408_cards DROP CONSTRAINT IF EXISTS exam_408_cards_source_key_fkey;
ALTER TABLE exam_408_demos DROP CONSTRAINT IF EXISTS exam_408_demos_knowledge_point_key_fkey;
ALTER TABLE exam_408_demos DROP CONSTRAINT IF EXISTS exam_408_demos_source_key_fkey;
ALTER TABLE exam_408_knowledge_maps DROP CONSTRAINT IF EXISTS exam_408_knowledge_maps_topic_key_fkey;

-- 解除外键后仍保留「按知识点映射」的查询索引（正常情况已由 085-087 创建，此处在回滚演练中作为重建契约）
CREATE INDEX IF NOT EXISTS idx_exam_408_study_point
  ON exam_408_study_topics(knowledge_point_key) WHERE knowledge_point_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_408_cards_point
  ON exam_408_cards(knowledge_point_key) WHERE knowledge_point_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_408_demos_point
  ON exam_408_demos(knowledge_point_key) WHERE knowledge_point_key IS NOT NULL;
ALTER TABLE exam_408_knowledge_maps DROP CONSTRAINT IF EXISTS exam_408_knowledge_maps_source_key_fkey;
