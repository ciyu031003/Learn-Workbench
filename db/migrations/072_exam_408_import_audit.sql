-- 072: register the 408 snapshot source in the generic import ledger.
--
-- The exam_408_* tables remain the authoritative storage for the snapshot.
-- This row only lets the importer write content_import_batch /
-- content_import_item audit rows with a valid foreign key. The source is
-- personal-study only and must not be treated as redistributable content.

INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note, verified_at)
VALUES (
  'beokayy-408',
  '四〇八档案室 · 408 历年真题',
  'https://zhenti.beokayy.club/',
  NULL,
  'bundle-2026-10-11',
  '站点未声明开源或转载许可；仅个人、非商业、本地学习使用，不再分发。',
  'import',
  '保留站点原始声明；个人学习自用，不扩大分发',
  '408 四门课章节/知识点与 2009-2026 历年真题快照；导入批次只做审计与回滚，不替代 exam_408_* 表。',
  now()
)
ON CONFLICT (key) DO NOTHING;
