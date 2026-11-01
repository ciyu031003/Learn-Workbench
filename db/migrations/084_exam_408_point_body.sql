-- 084: 408 专区知识点正文（点开即可先读正文，再刷该点真题）
-- 背景：专区 99 个知识点此前只有一句 summary，正文由 scripts/beokayy-408/enrich-point-bodies.mjs
--       从 scripts/beokayy-408/point-bodies/*.json 写入；与快照导入解耦（import-db 的 upsert 不含 body）。
ALTER TABLE exam_408_knowledge_points
  ADD COLUMN IF NOT EXISTS body jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN exam_408_knowledge_points.body IS
  '知识点正文段落（jsonb string[]，App/Web 逐段渲染）；由 scripts/beokayy-408/enrich-point-bodies.mjs 写入';
