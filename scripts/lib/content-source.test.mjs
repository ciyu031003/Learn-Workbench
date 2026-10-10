import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildImportItems,
  loadMappingFile,
  parseMarkdown,
  walkDocs,
} from "./content-source.mjs";

test("parseMarkdown：第一个 ATX 标题当标题，其后第一段正文当摘要", () => {
  const parsed = parseMarkdown("# 二分查找\n\n> 在有序数组中定位目标值。\n");
  assert.equal(parsed.title, "二分查找");
  assert.equal(parsed.summary, "在有序数组中定位目标值。");
});

test("parseMarkdown：去掉强调标记、跳过表格/代码块/列表", () => {
  const text = [
    "## **栈** 与 `队列`",
    "",
    "| 结构 | 特点 |",
    "| --- | --- |",
    "- 列表项不是摘要",
    "```java",
    "int x = 1;",
    "```",
    "真正的摘要。",
  ].join("\n");
  const parsed = parseMarkdown(text);
  assert.equal(parsed.title, "栈 与 队列");
  assert.equal(parsed.summary, "真正的摘要。");
});

test("parseMarkdown：没有标题 → null（不算可导入章节）", () => {
  assert.equal(parseMarkdown("只有正文，没有标题"), null);
  assert.equal(parseMarkdown(""), null);
});

test("parseMarkdown：摘要有 500 字上限，且没有摘要时为空串", () => {
  const long = `# 标题\n\n${"字".repeat(900)}`;
  assert.equal(parseMarkdown(long).summary.length, 500);
  assert.equal(parseMarkdown("# 标题\n").summary, "");
});

test("walkDocs：只收 md/mdx，跳过 .git 等目录，返回正斜杠相对路径并排序", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-docs-"));
  try {
    fs.mkdirSync(path.join(root, "docs", "nested"), { recursive: true });
    fs.mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "b.md"), "# b");
    fs.writeFileSync(path.join(root, "docs", "a.mdx"), "# a");
    fs.writeFileSync(path.join(root, "docs", "nested", "c.md"), "# c");
    fs.writeFileSync(path.join(root, "docs", "ignore.txt"), "x");
    fs.writeFileSync(path.join(root, "node_modules", "pkg", "d.md"), "# d");
    fs.writeFileSync(path.join(root, ".git", "e.md"), "# e");
    assert.deepEqual(walkDocs(root), ["docs/a.mdx", "docs/b.md", "docs/nested/c.md"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadMappingFile：缺失时 missing=true，存在时读 entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-map-"));
  try {
    assert.deepEqual(loadMappingFile(path.join(root, "nope.json")), { entries: {}, missing: true });
    const file = path.join(root, "map.json");
    fs.writeFileSync(file, JSON.stringify({ entries: { "docs/a.md": { trackSlug: "java" } } }), "utf8");
    const loaded = loadMappingFile(file);
    assert.equal(loaded.missing, false);
    assert.equal(loaded.entries["docs/a.md"].trackSlug, "java");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const docs = ["docs/b.md", "docs/a.md"];
const bodies = { "docs/a.md": "# 甲\n\n摘要甲。", "docs/b.md": "# 乙\n\n摘要乙。" };
const readText = (rel) => bodies[rel];

test("buildImportItems：没有映射的文件记为 unmapped，但仍产出条目（工作清单）", () => {
  const { items, parsed } = buildImportItems({ docs, readText, mapping: {} });
  assert.equal(parsed, 2);
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.unmapped === true));
  assert.ok(items.every((item) => item.targetKey === ""));
  assert.ok(items.every((item) => /^docs\/[ab]\.md#[0-9a-f]{16}$/.test(item.externalKey)));
});

test("buildImportItems：有映射时目标键＝<track>/<stage>/<topic>，并带上归属字段", () => {
  const mapping = {
    "docs/a.md": { trackSlug: "java", stageKey: "java-foundation", topicKey: "java-types-control" },
  };
  const { items } = buildImportItems({ docs, readText, mapping });
  const mapped = items.find((item) => item.path === "docs/a.md");
  assert.equal(mapped.targetKey, "java/java-foundation/java-types-control");
  assert.equal(mapped.unmapped, undefined);
  assert.equal(mapped.payload.trackSlug, "java");
  assert.equal(mapped.payload.title, "甲");
  assert.equal(mapped.payload.summary, "摘要甲。");
  assert.equal(items.find((item) => item.path === "docs/b.md").unmapped, true);
});

test("buildImportItems：映射可显式覆盖 targetKey / 标题 / 难度", () => {
  const mapping = {
    "docs/a.md": {
      trackSlug: "java",
      stageKey: "java-foundation",
      topicKey: "java-types-control",
      targetKey: "java/java-foundation/java-types-control#draft",
      title: "自定义标题",
      difficulty: "hard",
      tags: ["算法"],
      estimatedMinutes: 12,
    },
  };
  const { items } = buildImportItems({ docs: ["docs/a.md"], readText, mapping });
  assert.equal(items[0].targetKey, "java/java-foundation/java-types-control#draft");
  assert.equal(items[0].payload.title, "自定义标题");
  assert.equal(items[0].payload.difficulty, "hard");
  assert.deepEqual(items[0].payload.tags, ["算法"]);
  assert.equal(items[0].payload.estimatedMinutes, 12);
});

test("buildImportItems：scope 之外不收，limit 截断在映射之后仍稳定", () => {
  const scoped = buildImportItems({ docs, readText, mapping: {}, scope: ["docs/a.md"] });
  assert.equal(scoped.items.length, 1);
  assert.equal(scoped.items[0].path, "docs/a.md");

  const limited = buildImportItems({ docs, readText, mapping: {}, limit: 1 });
  assert.equal(limited.items.length, 1);
  assert.equal(limited.items[0].path, "docs/b.md");
});

test("buildImportItems：同一文件重复运行时指纹一致（可复现导入）", () => {
  const first = buildImportItems({ docs, readText, mapping: {} });
  const second = buildImportItems({ docs, readText, mapping: {} });
  assert.deepEqual(
    first.items.map((item) => item.payload.fingerprint),
    second.items.map((item) => item.payload.fingerprint)
  );
});
