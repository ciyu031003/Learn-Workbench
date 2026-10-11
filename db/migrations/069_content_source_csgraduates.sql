-- 069：csgraduates（计算机考研杂货铺）408 来源登记（组二 · 阶段 16）
--
-- 内容：从 https://www.csgraduates.com/ 抓取 408 知识点与 2009–2026 年 408 真题选择题
-- （题干 / 四个选项 / 正确答案 / 站点解析 / 考点标签）。
-- 落库形态：进 `packages/content`（新课程 `ex-408-grad`），由 `scripts/sync-content-model.mjs`
-- 物化到 knowledge_points / learning_questions / question_knowledge_point。
--
-- 许可口径（与迁移 068 一致）：**个人自用、不商用**，不再按「许可是否允许再分发」限制 import；
-- 仍如实登记来源的真实许可声明 —— 该站点页脚声明「保留所有权利」，这里**原样登记**，
-- 不冒充开源许可（`packages/content` 的来源条目与 db/schema.sql 保持同一串）。
--
-- 抓取口径：`scripts/cs-graduates/crawl.mjs` 只抓 408（四门课知识点页 + `/study_methods/408quiz/<年>/`），
-- 不抓数学/英语/政治；站点 robots.txt 为 `User-agent: *`（无 Disallow），请求带 UA、限并发、留请求间隔。
--
-- 幂等：ON CONFLICT (key) DO NOTHING；db/schema.sql 已同步登记。

INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note, verified_at)
VALUES
  ('csgraduates-408', '计算机考研杂货铺 · 408 知识库', 'https://www.csgraduates.com/', NULL, 'site-2026-10-11',
   '保留所有权利（站点声明）· 个人自用不商用', 'import',
   '如实登记许可；个人自用、不商用，仅在本地学习环境使用',
   '408 知识点（四门课 25 章 / 88 节）与 2009–2026 真题选择题（717 道，含解析）', now())
ON CONFLICT (key) DO NOTHING;
