/**
 * 轻量指标（组三 · H5 可观测）。
 *
 * 取舍：**不上 OpenTelemetry / Prometheus 客户端库**。
 *  - 单实例自用系统，进程内计数器 + 一个 `/api/internal/metrics` 文本端点就够被抓取；
 *  - 引客户端库会带来依赖、初始化顺序、采样与基数（cardinality）治理等一堆新问题，
 *    而当前要回答的问题只有几个：导入成功率、复习到期量、接口错误量、内容规模。
 *
 * 基数纪律：**标签值只允许来自固定枚举**（如 mode=dry-run|apply、status=success|failed）。
 * 绝不把 user id / 请求路径参数塞进标签 —— 那是指标系统被打爆的最常见原因。
 */

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

interface Histogram {
  count: number;
  sum: number;
  buckets: number[];
  bucketCounts: number[];
}
const histograms = new Map<string, Histogram>();

/** 毫秒直方图默认桶（覆盖本地毫秒级到外部请求的十几秒）。 */
const DEFAULT_BUCKETS = [5, 25, 100, 500, 1000, 5000, 15000];

type Labels = Record<string, string>;

/** 标签序列化成稳定字符串（键排序），保证同一组标签只有一条时间序列。 */
function labelKey(labels: Labels = {}): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return "{" + keys.map((k) => `${k}="${escapeLabel(String(labels[k]))}"`).join(",") + "}";
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function seriesKey(name: string, labels: Labels = {}): string {
  return `${name}${labelKey(labels)}`;
}

export function inc(name: string, labels: Labels = {}, by = 1): void {
  const key = seriesKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + by);
}

export function setGauge(name: string, value: number, labels: Labels = {}): void {
  gauges.set(seriesKey(name, labels), value);
}

export function observe(name: string, valueMs: number, labels: Labels = {}): void {
  const key = seriesKey(name, labels);
  let hist = histograms.get(key);
  if (!hist) {
    hist = { count: 0, sum: 0, buckets: DEFAULT_BUCKETS, bucketCounts: new Array(DEFAULT_BUCKETS.length).fill(0) };
    histograms.set(key, hist);
  }
  hist.count += 1;
  hist.sum += valueMs;
  for (let i = 0; i < hist.buckets.length; i += 1) {
    if (valueMs <= hist.buckets[i]) hist.bucketCounts[i] += 1;
  }
}

/** 只给测试与"预算重置"用；生产不要在运行中调用（会清掉 counters 并使路由缓存失效）。 */
export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
  metricsGeneration += 1;
}

export interface ExternalMetric {
  name: string;
  help: string;
  type: "gauge" | "counter";
  value: number;
  labels?: Labels;
}

/** 渲染成 Prometheus 文本格式（抓取端可直接用）。输出顺序稳定，便于 diff。 */
export function renderMetrics(external: ExternalMetric[] = []): string {
  const lines: string[] = [];
  const helps = new Map<string, string>();
  const types = new Map<string, string>();

  const sortedCounters = [...counters.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const sortedGauges = [...gauges.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const sortedHist = [...histograms.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const nameOf = (series: string) => series.replace(/\{.*$/, "");

  for (const [series, value] of sortedCounters) {
    const name = nameOf(series);
    helps.set(name, `process counter ${name}`);
    types.set(name, "counter");
    lines.push(`${series} ${value}`);
  }
  for (const [series, value] of sortedGauges) {
    const name = nameOf(series);
    if (!helps.has(name)) {
      helps.set(name, `process gauge ${name}`);
      types.set(name, "gauge");
    }
    lines.push(`${series} ${value}`);
  }
  for (const [series, hist] of sortedHist) {
    const name = nameOf(series);
    helps.set(name, `process histogram ${name} (ms)`);
    types.set(name, "histogram");
    for (let i = 0; i < hist.buckets.length; i += 1) {
      lines.push(`${name}_bucket${labelKeyWith(series, `le="${hist.buckets[i]}"`)} ${hist.bucketCounts[i]}`);
    }
    lines.push(`${name}_bucket${labelKeyWith(series, `le="+Inf"`)} ${hist.count}`);
    lines.push(`${name}_sum${labelKey(parseLabels(series))} ${hist.sum}`);
    lines.push(`${name}_count${labelKey(parseLabels(series))} ${hist.count}`);
  }
  for (const m of external) {
    helps.set(m.name, m.help);
    types.set(m.name, m.type);
    lines.push(`${m.name}${labelKey(m.labels ?? {})} ${m.value}`);
  }

  const header: string[] = [];
  for (const name of [...helps.keys()].sort()) {
    header.push(`# HELP ${name} ${helps.get(name)}`);
    header.push(`# TYPE ${name} ${types.get(name)}`);
  }
  return [...header, ...lines].join("\n") + "\n";
}

/** 把 `name{label="v"}` 里的标签还原成对象（直方图输出时用）。 */
function parseLabels(series: string): Labels {
  const match = /\{(.*)\}$/.exec(series);
  if (!match) return {};
  const out: Labels = {};
  for (const pair of match[1].split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out[pair.slice(0, eq)] = pair.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return out;
}

function labelKeyWith(series: string, extraPair: string): string {
  const existing = parseLabels(series);
  const parts = Object.keys(existing)
    .sort()
    .map((k) => `${k}="${existing[k]}"`);
  parts.push(extraPair);
  return "{" + parts.join(",") + "}";
}

/** 计时包装：`await timed("x", {label}, () => doWork())`。 */
export async function timed<T>(name: string, labels: Labels, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    observe(name, Date.now() - started, labels);
  }
}

/* ============================================================================
 * S4-5：进程/连接池指标 + 指标代际（供 /api/internal/metrics 与告警脚本）
 * ==========================================================================*/

/**
 * 指标"代际"：每次 resetMetrics() 自增。
 * 用途：路由内的短周期缓存（如 /api/internal/metrics 的 60s COUNT 缓存）据此失效 ——
 * 单测里 beforeEach(resetMetrics) 能拿到干净数据，不会出现"上一个用例的缓存串到下一个"。
 */
let metricsGeneration = 0;

export function metricsGenerationId(): number {
  return metricsGeneration;
}

export interface ProcessMetricInput {
  /** 进程启动时间（Date.now() 口径） */
  bootAt: number;
  /** 当前时间（测试注入） */
  now?: number;
  /** process.memoryUsage()（测试注入） */
  memory?: NodeJS.MemoryUsage;
}

/** 进程运行时长 / 内存指标（gauge）。字段名与 docs/运维告警规则.md 对齐。 */
export function collectProcessMetrics(input: ProcessMetricInput): ExternalMetric[] {
  const now = input.now ?? Date.now();
  const mem = input.memory ?? process.memoryUsage();
  const uptime = Math.max(0, Math.floor((now - input.bootAt) / 1000));
  return [
    { name: "lwb_process_uptime_seconds", help: "进程运行时长（秒）", type: "gauge", value: uptime },
    { name: "lwb_process_resident_memory_bytes", help: "RSS 常驻内存（字节）", type: "gauge", value: mem.rss },
    { name: "lwb_process_heap_used_bytes", help: "V8 heap 已用（字节）", type: "gauge", value: mem.heapUsed },
    { name: "lwb_process_heap_total_bytes", help: "V8 heap 总量（字节）", type: "gauge", value: mem.heapTotal },
  ];
}

/** pg.Pool 的最小结构（只读字段，便于测试注入；不要传真实连接对象）。 */
export interface PoolStatsLike {
  totalCount?: unknown;
  idleCount?: unknown;
  waitingCount?: unknown;
  options?: { max?: unknown } | unknown;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * PG 连接池指标（gauge）：total / idle / waiting / max / usage_ratio。
 * usage_ratio = totalCount / max（0~1），告警阈值 0.8 见 docs/运维告警规则.md。
 * 任何字段缺失都跳过该项（老版本 pg / 测试 mock 只提供 query 时不抛错）。
 */
export function collectPoolMetrics(pool: PoolStatsLike, maxOverride?: unknown): ExternalMetric[] {
  const total = finiteNumber(pool.totalCount);
  const idle = finiteNumber(pool.idleCount);
  const waiting = finiteNumber(pool.waitingCount);
  const options = pool.options as { max?: unknown } | undefined;
  const max = finiteNumber(maxOverride ?? options?.max);

  const out: ExternalMetric[] = [];
  const push = (name: string, help: string, value: number | null) => {
    if (value === null) return;
    out.push({ name, help, type: "gauge", value });
  };
  push("lwb_pg_pool_total_connections", "连接池已建连接数（含空闲）", total);
  push("lwb_pg_pool_idle_connections", "连接池空闲连接数", idle);
  push("lwb_pg_pool_waiting_requests", "等待拿连接的请求数", waiting);
  push("lwb_pg_pool_max_connections", "连接池上限（PGPOOL_MAX）", max);
  if (total !== null && max !== null && max > 0) {
    push("lwb_pg_pool_usage_ratio", "连接池占用率 total/max", Math.round((total / max) * 1000) / 1000);
  }
  return out;
}
