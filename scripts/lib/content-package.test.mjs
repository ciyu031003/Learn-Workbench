import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPackageImportItems,
  packageFingerprint,
  validateContentPackage,
} from "./content-package.mjs";

function validPackage(overrides = {}) {
  return {
    formatVersion: 1,
    packageKey: "pilot-408-data-structure",
    title: "408 数据结构试点",
    domain: "exam-408",
    status: "review",
    source: {
      key: "beokayy-408",
      name: "四〇八档案室",
      url: "https://zhenti.beokayy.club/",
      license: "个人学习、非商业使用；不再分发",
      usage: "personal-study",
      ref: "bundle-2026-10-11",
      capturedAt: "2026-10-11T08:46:59.937Z",
    },
    course: {
      key: "ex-408-grad",
      title: "408 考研专项",
      category: "408",
    },
    chapters: [
      {
        key: "ds-02",
        title: "线性表",
        subjectKey: "data-structure",
        subjectTitle: "数据结构",
        chapterNumber: 2,
        points: [
          {
            key: "ds-02-02",
            title: "线性表的顺序表示",
            summary: "顺序表的随机访问、插入和删除代价。",
            tags: ["线性表", "顺序表"],
            sourceUrl: "https://zhenti.beokayy.club/knowledge",
          },
        ],
      },
    ],
    questions: [
      {
        key: "2023-01",
        externalId: "2023-01",
        type: "choice",
        subjectKey: "data-structure",
        year: 2023,
        number: 1,
        pointsPossible: 2,
        prompt: "顺序表按位访问的平均时间复杂度是？",
        options: [
          { key: "A", text: "O(1)" },
          { key: "B", text: "O(log n)" },
          { key: "C", text: "O(n)" },
          { key: "D", text: "O(n log n)" },
        ],
        answer: { choice: "A", text: "答案：A" },
        knowledgePointKeys: ["ds-02-02"],
        tags: ["顺序表", "复杂度"],
        sourceUrl: "https://zhenti.beokayy.club/question/2023-01",
      },
    ],
    review: {
      status: "pending",
      reviewer: "",
      reviewedAt: "",
      note: "自动导入后等待人工复核",
    },
    ...overrides,
  };
}

test("valid content package produces review import items", () => {
  const result = validateContentPackage(validPackage());
  assert.equal(result.ok, true);
  assert.deepEqual(result.stats, { chapters: 1, points: 1, questions: 1, links: 1, subjects: 1 });
  assert.equal(result.publishable, false);
  assert.deepEqual(
    result.importItems.map((item) => [item.kind, item.externalKey]),
    [
      ["knowledge-point", "point:ds-02-02"],
      ["question", "question:2023-01"],
    ],
  );
  assert.equal(result.importItems[1].payload.status, "review");
  assert.ok(result.importItems.every((item) => item.unmapped === true));
});

test("duplicate keys and unknown point links are rejected", () => {
  const pkg = validPackage();
  pkg.chapters[0].points.push({ ...pkg.chapters[0].points[0] });
  pkg.questions[0].knowledgePointKeys = ["missing-point"];
  const result = validateContentPackage(pkg);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate key ds-02-02")));
  assert.ok(result.errors.some((error) => error.includes("unknown point missing-point")));
});

test("choice questions require four options and a valid answer letter", () => {
  const pkg = validPackage();
  pkg.questions[0].options = pkg.questions[0].options.slice(0, 3);
  pkg.questions[0].answer.choice = "E";
  const result = validateContentPackage(pkg);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("exactly four options")));
  assert.ok(result.errors.some((error) => error.includes("answer.choice")));
});

test("unsafe HTML is rejected before import", () => {
  const pkg = validPackage();
  pkg.questions[0].prompt = '<script>alert("x")</script>';
  const result = validateContentPackage(pkg);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unsafe HTML")));
});

test("packages must enter the pipeline as review", () => {
  const result = validateContentPackage(validPackage({ status: "published" }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("must enter the import pipeline as review")));
});

test("strict mode treats quality warnings as errors", () => {
  const pkg = validPackage();
  pkg.chapters[0].points[0].summary = "";
  const result = validateContentPackage(pkg, { strict: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("summary: empty")));
});

test("package fingerprint and import items are stable", () => {
  const first = buildPackageImportItems(validPackage());
  const second = buildPackageImportItems(validPackage());
  assert.equal(packageFingerprint(validPackage()), packageFingerprint(validPackage()));
  assert.deepEqual(first, second);
});
