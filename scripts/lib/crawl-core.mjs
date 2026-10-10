/**
 * 抓取内核的纯逻辑（组一 · 阶段 6 抽出）。
 *
 * 抽出的原因：`crawl_interview.mjs` 此前是「裸 fetch + 固定 sleep」——
 * 没有超时（CDN 卡住整轮 cron 就挂死）、没有重试（一次抖动就少一批题）、
 * 没有并发上限（只能串行慢慢爬）、失败文件也不落盘（下次重爬还是全量）。
 * 这里把最需要被测试的部分抽成纯函数：退避节奏、失败清单、统计口径。
 */

/** 默认策略：单请求超时 20s，最多 3 次尝试，退避 400ms / 1200ms，请求间 160ms，并发 4。 */
export const DEFAULT_FETCH_POLICY = {
  timeoutMs: 20_000,
  retries: 2,
  backoffMs: 400,
  gapMs: 160,
  concurrency: 4,
};

/** 第 n 次失败后要等多久（n 从 1 开始）；指数退避，不引入抖动以便可测。 */
export function backoffDelay(attempt, baseMs = DEFAULT_FETCH_POLICY.backoffMs) {
  const n = Math.max(1, Math.floor(Number(attempt) || 1));
  return baseMs * 2 ** (n - 1);
}

/**
 * 把一个数组切成不超过 `limit` 个批次（静态分片，便于复现）。
 * 例：splitIntoBatches([0..9], 4) -> 4 组，长度 3/3/3/1。
 */
export function splitIntoBatches(items, limit) {
  const n = Math.max(1, Math.floor(Number(limit) || 1));
  const list = Array.isArray(items) ? items : [];
  const size = Math.ceil(list.length / n) || 1;
  const batches = [];
  for (let i = 0; i < list.length; i += size) batches.push(list.slice(i, i + size));
  return batches;
}

/** 失败的抓取记账：url → 最后一次错误信息（幂等覆盖，避免重试后仍留旧错）。 */
export function recordFailure(failures, url, error) {
  failures.set(url, String(error?.message ?? error).slice(0, 200));
  return failures;
}

/** 失败清单落盘/读回（跨运行可复用：上次卡住的文件下次优先重爬）。 */
export function serializeFailures(failures) {
  const entries = [...failures.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([url, error]) => ({ url, error }));
}

export function restoreFailures(raw) {
  const out = new Map();
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.failures) ? raw.failures : [];
  for (const item of list) {
    const url = String(item?.url ?? "").trim();
    if (url) out.set(url, String(item?.error ?? "").slice(0, 200));
  }
  return out;
}

/** 去掉空白、去重、排序，得到一份稳定的「待处理文件」清单。 */
export function normalizeFileList(files) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(files) ? files : []) {
    const file = String(raw ?? "").trim().replace(/^\/+/, "");
    if (!file || seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** 单次运行的抓取统计（写进 manifest，也回填运行记录）。 */
export function crawlStats(input) {
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const filesOk = num(input?.filesOk);
  const filesFailed = num(input?.filesFailed);
  return {
    filesOk,
    filesFailed,
    filesTotal: filesOk + filesFailed,
    requests: num(input?.requests),
    retried: num(input?.retried),
  };
}
