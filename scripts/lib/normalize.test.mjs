import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSalary, parsePublished, stripHtml, contentHash } from "./normalize.js";

test("parseSalary: k 区间", () => {
  assert.deepEqual(parseSalary("15k-25k"), [15, 25]);
  assert.deepEqual(parseSalary("15K-25K·13薪"), [15, 25]);
});

test("parseSalary: 万区间（月薪）", () => {
  assert.deepEqual(parseSalary("2万-3万/月"), [20, 30]);
});

test("parseSalary: 年薪折算为月薪", () => {
  assert.deepEqual(parseSalary("30-50万/年"), [25, 42]); // 300/12=25, 500/12≈41.67→42
});

test("parseSalary: 单值与面议", () => {
  assert.deepEqual(parseSalary("30万/年以上"), [25, 25]); // 含「年」按年薪折算
  assert.deepEqual(parseSalary("面议"), [null, null]);
  assert.deepEqual(parseSalary(""), [null, null]);
});

test("parsePublished: 毫秒/秒时间戳与文本", () => {
  const iso = parsePublished(1725000000000);
  assert.ok(iso && /^\d{4}-\d{2}-\d{2}T/.test(iso), `got ${iso}`);
  const iso2 = parsePublished(1725000000);
  assert.ok(iso2 && /^\d{4}-\d{2}-\d{2}T/.test(iso2), `got ${iso2}`);
  const iso3 = parsePublished("2026-08-14 10:00:00");
  // 无时区后缀按本地时间解析，toISOString 转 UTC（时区会偏移小时），只断言 ISO 结构
  assert.ok(iso3 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(iso3), `got ${iso3}`);
  assert.equal(parsePublished(""), null);
  assert.equal(parsePublished("not-a-date"), null);
});

test("stripHtml: 去标签与实体还原", () => {
  assert.equal(stripHtml("<p>a&amp;b</p>"), "a&b");
  assert.equal(stripHtml("<script>bad()</script>ok"), "ok");
  assert.equal(stripHtml("<style>.x{}</style>ok"), "ok");
  assert.equal(stripHtml("a\u3000\u3000b"), "a b");
});

test("contentHash: 稳定且随字段变化", () => {
  const a = { source: "lagou", source_job_id: "1", title: "前端", tags: ["React"] };
  const b = { ...a };
  const c = { ...a, title: "后端" };
  assert.equal(contentHash(a), contentHash(b));
  assert.notEqual(contentHash(a), contentHash(c));
});