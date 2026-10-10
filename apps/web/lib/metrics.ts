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

/** 只给测试与"预算重置"用；生产不要在运行中调用。 */
export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
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
