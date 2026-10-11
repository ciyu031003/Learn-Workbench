-- 070：runoob（菜鸟教程）来源登记（组二 · 内容平台扩容）
--
-- 内容：从 https://www.runoob.com/ 抓取「有官方测验」的 19 个教程的知识点与测验题
-- （题干 / 选项 / 正确答案 / 站点解析），整理为 3 门课程（rn-frontend / rn-lang / rn-cs-tools）。
-- 落库形态：进 `packages/content`（新课程），由 `scripts/sync-content-model.mjs`
-- 物化到 knowledge_points / learning_questions / question_knowledge_point。
--
-- 许可口径（与迁移 068/069 一致）：**个人自用、不商用**；如实登记站点声明（页脚 Copyright
-- © 2013-2026，**未声明开源许可**），不冒充开源许可。`packages/content` 的来源条目与
-- db/schema.sql 保持同一串。
--
-- 抓取口径：`scripts/runoob/crawl.mjs` 只抓 `/quiz/<slug>-quiz.html` 与教程首页 + 左侧栏同目录子页；
-- 遵守 robots.txt（不抓 /try/、/wp-admin/、feed、/?s=），请求带 UA、限并发、留请求间隔。
--
-- 幂等：ON CONFLICT (key) DO NOTHING；db/schema.sql 已同步登记。

INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note, verified_at)
VALUES
  ('runoob-com', '菜鸟教程（runoob.com）', 'https://www.runoob.com/', NULL, 'site-2026-10-11',
   '站点声明 Copyright © 2013-2026（保留所有权利，未声明开源许可）· 个人自用不商用', 'import',
   '如实登记许可；个人自用、不商用，仅在本地学习环境使用',
   '19 个教程的知识点（1031 页 → 92 个知识点）与官方测验题（436 道，含答案与解析）', now())
ON CONFLICT (key) DO NOTHING;
