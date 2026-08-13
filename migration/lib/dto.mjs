// dto.mjs — Step 4: Migration DTO（§21）
// 中间格式：{ sourceId, title, slug, content, type, date, tags, sourcePath, metadata }
// 不依赖源/目标数据库结构，可重复迁移、可调试、可生成报告。
import fs from "node:fs";
import path from "node:path";
import { buildInventory } from "./inventory.mjs";

const SOURCE_ROOT = path.join(process.cwd(), "migration/source/travel-notes");

export const TYPE = {
  NOTE: "NOTE",
  TUTORIAL: "TUTORIAL",
  REFERENCE: "REFERENCE",
  MINDMAP: "MINDMAP",
  REVIEW: "REVIEW",
  PROJECT_NOTE: "PROJECT_NOTE",
};

function normalizeSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "")
    .replace(/-+/g, "-");
}

function readBody(relPath) {
  const text = fs.readFileSync(path.join(SOURCE_ROOT, relPath), "utf8").replace(/^\uFEFF/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

/**
 * 从盘点结果构建 Migration DTO 数组。
 * 返回：{ dtos, warnings }
 */
export function buildDtos() {
  const inv = buildInventory();
  const warnings = [];
  const dtos = [];

  for (const item of inv.items) {
    let content;
    let mainRel = item.sourcePath;
    if (item.sourceType === "repo") {
      content = readBody(item.sourcePath + "/README.md");
      mainRel = item.sourcePath + "/README.md";
    } else {
      content = readBody(item.sourcePath);
    }

    const typeMap = {
      "knowledge:NOTE": TYPE.NOTE,
      "knowledge:MINDMAP": TYPE.MINDMAP,
      "project:PROJECT_NOTE": TYPE.PROJECT_NOTE,
    };
    const type = typeMap[item.target] || TYPE.NOTE;
    const slug = normalizeSlug(item.slug) || normalizeSlug(item.title);

    const dto = {
      sourceId: "travel-notes:" + item.sourceType + ":" + item.slug,
      title: item.title,
      slug,
      content,
      type,
      date: item.date ? new Date(item.date).toISOString() : null,
      tags: [...item.tags],
      sourcePath: mainRel,
      metadata: {
        sourceProject: "Travel-Notes",
        sourceCommit: "fb9978a",
        sourceType: item.sourceType,
        category: item.category,
        description: item.description,
        assets: item.assets.map((a) => ({ source: a })),
        stats: item.content,
      },
    };
    dtos.push(dto);
  }

  // Slug 唯一性校验
  const seen = new Set();
  for (const d of dtos) {
    if (seen.has(d.slug)) warnings.push("重复 slug: " + d.slug);
    seen.add(d.slug);
  }
  // 非空校验
  for (const d of dtos) {
    if (!d.title) warnings.push("缺少标题: " + d.slug);
    if (!d.content || !d.content.trim()) warnings.push("内容为空: " + d.slug);
  }

  return { dtos, warnings };
}
