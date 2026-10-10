import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IMPORT_REASONS,
  buildDryRunReport,
  canonicalJson,
  countActions,
  detectConflicts,
  fingerprintOf,
  inScope,
  normalizeExternalKey,
  normalizePath,
  normalizeTitle,
  planImport,
  shortHash,
  toImportItemRows,
} from "./import-pipeline.mjs";

const point = (externalKey, targetKey, title, payload) => ({
  kind: "knowledge-point",
  externalKey,
  targetKey,
  title,
  payload,
  path: "src/lesson.md",
});

test("normalizeTitle 统一全半角、折叠空白、大小写", () => {
  assert.equal(normalizeTitle("  Hello   World  "), "hello world");
  assert.equal(normalizeTitle("ＡＢＣ　Ｄ"), "abc d");
  assert.equal(normalizeTitle(null), "");
});

test("normalizePath 统一分隔符并去掉 ./ 与重复斜杠", () => {
  assert.equal(normalizePath(".\\docs\\a//b.md"), "docs/a/b.md");
  assert.equal(normalizePath("/leading/slash.md"), "leading/slash.md");
});

test("normalizeExternalKey 用标题指纹，源重排顺序后键不变", () => {
  const a = normalizeExternalKey("src/a.md", "二分查找");
  const b = normalizeExternalKey("./src/a.md", "  二分查找 ");
  assert.equal(a, b);
  assert.match(a, /^src\/a\.md#[0-9a-f]{16}$/);
});

test("normalizeExternalKey 无标题时退化为纯路径", () => {
  assert.equal(normalizeExternalKey("src/a.md", ""), "src/a.md");
});

test("shortHash 与 canonicalJson 是确定性的", () => {
  assert.equal(shortHash("x"), shortHash("x"));
  assert.equal(shortHash("x").length, 16);
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
  assert.equal(fingerprintOf({ a: 1, b: 2 }), fingerprintOf({ b: 2, a: 1 }));
});

test("inScope：空 scope 不限，前缀按路径段匹配", () => {
  assert.equal(inScope("anything/here.md", []), true);
  assert.equal(inScope("docs/a.md", ["docs"]), true);
  assert.equal(inScope("docs-extra/a.md", ["docs"]), false);
  assert.equal(inScope("docs/a.md", ["docs/"]), true);
});

test("planImport：新条目进 new，指纹一致进 skip，指纹变化进 update", () => {
  const existing = [
    { externalKey: "a#1", kind: "knowledge-point", targetKey: "java/1", fingerprint: "stale-fp" },
    {
      externalKey: "b#1",
      kind: "knowledge-point",
      targetKey: "java/2",
      fingerprint: fingerprintOf({ title: "没变" }),
    },
  ];
  const incoming = [
    point("a#1", "java/1", "变了", { title: "变了" }),
    point("b#1", "java/2", "没变", { title: "没变" }),
    point("c#1", "java/3", "新的", { title: "新的" }),
  ];
  const plan = planImport({
    existing,
    incoming,
    options: { answerChangedRequiresReview: false },
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].externalKey, "a#1");
  assert.equal(plan.update[0].previousFingerprint, "stale-fp");
  assert.equal(plan.skip.length, 1);
  assert.equal(plan.skip[0].externalKey, "b#1");
  assert.equal(plan.new.length, 1);
  assert.equal(plan.new[0].externalKey, "c#1");
});

test("planImport：unchanged 的条目带 unchanged 原因", () => {
  const incoming = [point("a#1", "java/1", "标题", { title: "标题" })];
  const fp = fingerprintOf({ title: "标题" });
  const plan = planImport({
    existing: [{ externalKey: "a#1", kind: "knowledge-point", targetKey: "java/1", fingerprint: fp }],
    incoming,
    options: { answerChangedRequiresReview: false },
  });
  assert.equal(plan.skip.length, 1);
  assert.equal(plan.skip[0].reason, IMPORT_REASONS.unchanged);
});

test("planImport：非法条目进 failed 并带原因码", () => {
  const plan = planImport({
    incoming: [
      { kind: "widget", externalKey: "x#1", targetKey: "y", title: "t" },
      { kind: "knowledge-point", externalKey: "", targetKey: "y", title: "t" },
      { kind: "knowledge-point", externalKey: "x#1", targetKey: "", title: "t" },
      { kind: "knowledge-point", externalKey: "x#1", targetKey: "y", title: "  " },
    ],
  });
  assert.deepEqual(
    plan.failed.map((f) => f.reason),
    [
      IMPORT_REASONS.invalidKind,
      IMPORT_REASONS.missingExternalKey,
      IMPORT_REASONS.missingTargetKey,
      IMPORT_REASONS.missingTitle,
    ]
  );
});

test("planImport：scope 之外直接 skip，不参与 new/update", () => {
  const plan = planImport({
    incoming: [{ ...point("a#1", "java/1", "标题", { title: "标题" }), path: "vendor/a.md" }],
    scope: ["src"],
  });
  assert.equal(plan.skip.length, 1);
  assert.equal(plan.skip[0].reason, IMPORT_REASONS.outOfScope);
  assert.equal(plan.new.length, 0);
});

test("detectConflicts：同一外部键内容不同 → duplicate-external-key", () => {
  const conflicts = detectConflicts(
    [],
    [point("a#1", "java/1", "标题", { title: "甲" }), point("a#1", "java/1", "标题", { title: "乙" })]
  );
  assert.equal(conflicts.get("a#1"), IMPORT_REASONS.duplicateExternalKey);
});

test("detectConflicts：两个外部键指向同一目标 → target-collision（双方都标）", () => {
  const conflicts = detectConflicts(
    [],
    [
      point("a#1", "java/1", "甲", { title: "甲" }),
      point("b#1", "java/1", "乙", { title: "乙" }),
    ]
  );
  assert.equal(conflicts.get("a#1"), IMPORT_REASONS.targetCollision);
  assert.equal(conflicts.get("b#1"), IMPORT_REASONS.targetCollision);
});

test("detectConflicts：答案变化必须人工审核，不可自动上线", () => {
  const existing = [
    {
      externalKey: "q#1",
      kind: "question",
      targetKey: "java/q1",
      fingerprint: "fp-old",
      hasAnswer: true,
    },
  ];
  const incoming = [
    {
      kind: "question",
      externalKey: "q#1",
      targetKey: "java/q1",
      title: "题面没变",
      payload: { title: "题面没变", answer: "新答案" },
    },
  ];
  const conflicts = detectConflicts(existing, incoming);
  assert.equal(conflicts.get("q#1"), IMPORT_REASONS.answerChangeRequiresReview);

  const bypass = detectConflicts(existing, incoming, { answerChangedRequiresReview: false });
  assert.equal(bypass.size, 0);
});

test("planImport：冲突条目进 conflict 桶，且不被判为 update", () => {
  const plan = planImport({
    incoming: [
      point("a#1", "java/1", "甲", { title: "甲" }),
      point("b#1", "java/1", "乙", { title: "乙" }),
    ],
  });
  assert.equal(plan.conflict.length, 2);
  assert.equal(plan.update.length, 0);
  assert.equal(plan.new.length, 0);
});

test("buildDryRunReport：数量真实、明细截断、冲突原因汇总", () => {
  const plan = planImport({
    incoming: [
      point("a#1", "java/1", "甲", { title: "甲" }),
      point("b#1", "java/1", "乙", { title: "乙" }),
      point("c#1", "java/2", "丙", { title: "丙" }),
      { kind: "bogus", externalKey: "d#1", targetKey: "e", title: "t" },
    ],
  });
  const report = buildDryRunReport(plan, { limit: 1 });
  assert.deepEqual(report.counts, { new: 1, update: 0, skip: 0, conflict: 2, failed: 1 });
  assert.equal(report.details.conflict.length, 1);
  assert.match(report.lines[0], /新增 1 \/ 更新 0 \/ 跳过 0 \/ 冲突 2 \/ 失败 1/);
  assert.match(report.lines[1], /target-collision×2/);
  assert.match(report.lines[2], /invalid-kind×1/);
});

test("toImportItemRows + countActions：拍平成插入行并计数", () => {
  const plan = planImport({
    incoming: [
      point("a#1", "java/1", "甲", { title: "甲" }),
      point("b#1", "java/1", "乙", { title: "乙" }),
    ],
  });
  const rows = toImportItemRows(plan, 42);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.batchId === 42));
  assert.deepEqual(countActions(rows), { new: 0, update: 0, skip: 0, conflict: 2, failed: 0 });
});
