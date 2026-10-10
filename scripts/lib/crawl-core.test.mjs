import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FETCH_POLICY,
  backoffDelay,
  crawlStats,
  normalizeFileList,
  recordFailure,
  restoreFailures,
  serializeFailures,
  splitIntoBatches,
} from "./crawl-core.mjs";

test("backoffDelay：指数退避，从 1 开始，非法输入按 1 处理", () => {
  assert.equal(backoffDelay(1), 400);
  assert.equal(backoffDelay(2), 800);
  assert.equal(backoffDelay(3), 1600);
  assert.equal(backoffDelay(0), 400);
  assert.equal(backoffDelay("x"), 400);
  assert.equal(backoffDelay(2, 100), 200);
});

test("splitIntoBatches：并发上限生效，且不丢项", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  const batches = splitIntoBatches(items, 4);
  assert.ok(batches.length <= 4);
  assert.deepEqual(batches.map((b) => b.length), [3, 3, 3, 1]);
  assert.deepEqual(batches.flat().sort((a, b) => a - b), items);

  assert.deepEqual(splitIntoBatches([], 4), []);
  assert.deepEqual(splitIntoBatches([1, 2], 0), [[1, 2]]);
});

test("recordFailure 幂等覆盖，serialize/restore 往返一致", () => {
  const failures = new Map();
  recordFailure(failures, "https://cdn/x.md", new Error("HTTP 500"));
  recordFailure(failures, "https://cdn/x.md", new Error("HTTP 503"));
  recordFailure(failures, "https://cdn/a.md", "timeout");
  assert.equal(failures.size, 2);
  assert.equal(failures.get("https://cdn/x.md"), "HTTP 503");

  const dumped = serializeFailures(failures);
  assert.deepEqual(dumped, [
    { url: "https://cdn/a.md", error: "timeout" },
    { url: "https://cdn/x.md", error: "HTTP 503" },
  ]);

  const restored = restoreFailures({ failures: dumped });
  assert.equal(restored.size, 2);
  assert.equal(restored.get("https://cdn/a.md"), "timeout");
  assert.equal(restoreFailures(null).size, 0);
  assert.equal(restoreFailures([{ error: "no url" }]).size, 0);
});

test("normalizeFileList：去空白、去重、去前导斜杠、排序", () => {
  assert.deepEqual(
    normalizeFileList(["/b.md", "a.md", " b.md", "", null, "a.md"]),
    ["a.md", "b.md"]
  );
  assert.deepEqual(normalizeFileList(undefined), []);
});

test("crawlStats：total = ok + failed，负数按 0，字段齐全", () => {
  const s = crawlStats({ filesOk: 120, filesFailed: 3, requests: 260, retried: 7 });
  assert.deepEqual(s, { filesOk: 120, filesFailed: 3, filesTotal: 123, requests: 260, retried: 7 });
  assert.deepEqual(crawlStats({ filesOk: -5 }), { filesOk: 0, filesFailed: 0, filesTotal: 0, requests: 0, retried: 0 });
});

test("默认策略有界：超时/重试/并发都在合理范围", () => {
  assert.ok(DEFAULT_FETCH_POLICY.timeoutMs > 0);
  assert.ok(DEFAULT_FETCH_POLICY.retries >= 1);
  assert.ok(DEFAULT_FETCH_POLICY.concurrency >= 1 && DEFAULT_FETCH_POLICY.concurrency <= 8);
  assert.ok(DEFAULT_FETCH_POLICY.gapMs >= 100, "限速不低于 100ms，避免打爆 CDN");
});
