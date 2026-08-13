// verify.mjs — 校验层（方案 §24）
// 检查：标题数量一致 / 正文数量一致 / 标签数量一致 / 图片数量一致 / 日期一致 / Slug 唯一 / Markdown 可解析 / Mermaid 正常 / 特殊字符正常
import fs from "node:fs";
import path from "node:path";

function balancedFences(text) {
  const fences = text.match(/^```/gm) || [];
  return fences.length % 2 === 0;
}

function mermaidBlocks(text) {
  const re = /^```mermaid\s*\n([\s\S]*?)\n?```/gm;
  const blocks = [];
  let m;
  while ((m = re.exec(text))) blocks.push(m[1]);
  return blocks;
}

export async function verifyMigration(pool, sourceDtos) {
  const { rows: notes } = await pool.query(
    `SELECT n.id, n.title, n.slug, n.content, n.type, n.status, n.source_path AS "sourcePath",
            n.published_at AS "publishedAt",
            COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '{}') AS tags
     FROM knowledge_notes n
     LEFT JOIN knowledge_note_tags nt ON nt.note_id = n.id
     LEFT JOIN knowledge_tags t ON t.id = nt.tag_id
     WHERE n.source_id LIKE 'travel-notes:%'
     GROUP BY n.id
     ORDER BY n.id`
  );
  const srcBySlug = new Map(sourceDtos.map((d) => [d.slug, d]));
  const checks = [];
  const fail = (name, ok, detail) => checks.push({ name, ok, detail });

  // 1. 标题数量一致
  const srcTitles = sourceDtos.filter((d) => d.title).length;
  const dstTitles = notes.filter((n) => n.title).length;
  fail("标题数量一致", srcTitles === dstTitles, `源 ${srcTitles} / 目标 ${dstTitles}`);

  // 2. 正文数量一致
  const srcContents = sourceDtos.filter((d) => d.content && d.content.trim()).length;
  const dstContents = notes.filter((n) => n.content && n.content.trim()).length;
  fail("正文数量一致", srcContents === dstContents, `源 ${srcContents} / 目标 ${dstContents}`);

  // 3. 标签数量一致
  const srcTags = new Set(sourceDtos.flatMap((d) => d.tags));
  const dstTags = new Set(notes.flatMap((n) => n.tags));
  const tagOk = [...srcTags].every((t) => dstTags.has(t)) && srcTags.size === dstTags.size;
  fail("标签数量一致", tagOk, `源 ${srcTags.size} 个 / 目标 ${dstTags.size} 个：[${[...srcTags].join("、")}]`);

  // 4. 图片数量一致
  const countImages = (text) => (text.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
  const srcImages = sourceDtos.reduce((s, d) => s + countImages(d.content), 0);
  const dstImages = notes.reduce((s, n) => s + countImages(n.content), 0);
  fail("图片数量一致", srcImages === dstImages, `源 ${srcImages} / 目标 ${dstImages}`);

  // 5. 日期一致
  const dateMismatches = [];
  for (const n of notes) {
    const src = srcBySlug.get(n.slug);
    if (!src) continue;
    const sDate = src.date ? new Date(src.date).toISOString() : null;
    const dDate = n.publishedAt ? new Date(n.publishedAt).toISOString() : null;
    if ((sDate || null) !== (dDate || null)) dateMismatches.push(`${n.slug}: ${sDate} != ${dDate}`);
  }
  fail("日期一致", dateMismatches.length === 0, dateMismatches.length ? dateMismatches.join("; ") : "全部一致");

  // 6. Slug 唯一
  const slugs = notes.map((n) => n.slug);
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  fail("Slug 唯一", dup.length === 0, dup.length ? "重复: " + [...new Set(dup)].join(",") : "无重复");

  // 7. Markdown 可解析（代码围栏成对）
  const badMd = notes.filter((n) => !balancedFences(n.content));
  fail("Markdown 可解析（代码围栏成对）", badMd.length === 0, badMd.length ? "异常: " + badMd.map((n) => n.slug).join(",") : "全部成对");

  // 8. Mermaid 正常（mermaid 块存在且围栏成对）
  const srcMermaid = sourceDtos.filter((d) => mermaidBlocks(d.content).length > 0).map((d) => d.slug);
  const badMermaid = [];
  for (const n of notes) {
    if (!srcMermaid.includes(n.slug)) continue;
    const blocks = mermaidBlocks(n.content);
    if (blocks.length === 0) badMermaid.push(n.slug + "(缺少 mermaid)");
    for (const b of blocks) {
      if (!b.includes("-->") && !/\b(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|mindmap|journey|gantt|pie)\b/.test(b)) {
        badMermaid.push(n.slug + "(疑似空/异常 mermaid)");
      }
    }
  }
  fail("Mermaid 正常", badMermaid.length === 0, badMermaid.length ? badMermaid.join("; ") : "mermaid 块完整");

  // 9. 特殊字符正常（正文往返一致：CJK/emoji/引号/反斜杠等）
  const charMismatch = [];
  for (const n of notes) {
    const src = srcBySlug.get(n.slug);
    if (!src) continue;
    if (n.content !== src.content) {
      charMismatch.push(`${n.slug}: 内容长度 源 ${src.content.length} / 目标 ${n.content.length}`);
    }
  }
  fail("特殊字符/正文往返一致", charMismatch.length === 0, charMismatch.length ? charMismatch.join("; ") : "正文逐字符一致");

  const allOk = checks.every((c) => c.ok);
  return { checks, allOk, notesCount: notes.length, sourceCount: sourceDtos.length };
}
