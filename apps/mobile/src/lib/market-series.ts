/**
 * 市场时间趋势的**聚合**纯逻辑（v1.31）。
 *
 * 真机反馈：市场工作台的「市场时间趋势」卡片里，胶囊柱状图太密 —— 柱子之间的日期数字
 * 互相重合（柱宽只有几 dp，标签必然溢出）。
 * 解法：按**时间间隔聚合**（例如每 3 小时 / 每天 / 每 3 天），柱数压到手机上能舒适阅读的
 * 量级（默认 <= 12 根），并只在少数位置渲染标签。聚合口径会在 UI 上标明。
 *
 * 零依赖（不 import react-native），vitest 可直接加载。
 */

export interface SeriesPoint {
  date: string;
  newJobs: number;
}

export interface SeriesBucket {
  /** 稳定 key（用于 React key），形如 2026-09-29 或 2026-09-29T06 */
  key: string;
  /** x 轴标签：日粒度 MM-DD、小时粒度 HH:00 */
  label: string;
  value: number;
}

export interface AggregatedSeries {
  buckets: SeriesBucket[];
  /** 聚合口径文案，例如「每 3 小时」「每天」「每 3 天」；未聚合时为「原始粒度」 */
  intervalLabel: string;
  /** 是否发生了聚合（未聚合时 buckets 与原始点一一对应） */
  aggregated: boolean;
  /** 原始点数（用于「共 N 条记录」这类说明） */
  rawCount: number;
}

/** 手机上舒适的柱数上限：10 根时每根约 33dp，标签也有呼吸空间（用户要"更集中一点"） */
export const MAX_BARS = 10;

/** 聚合阶梯（小时）。按这个顺序挑第一个"柱数不超标"的间隔 */
const LADDER_HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 168, 240, 336, 720];

const HOUR_MS = 3600 * 1000;

/** 解析日期：纯日期按 UTC 解析（避免时区把日期整体挪一天），带时间的走 Date.parse */
export function parsePointMs(date: string): number | null {
  const d = date.trim();
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  }
  // 无时区的 ISO（YYYY-MM-DDTHH:MM[:SS]）**按 UTC 解析**：
  // 标签格式化用的是 getUTC*，若这里按本地时区解析，标签会整体偏移几个小时（真机上表现为 x 轴错位）。
  const noTimezone = /^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}(:[0-9]{2})?$/.test(d);
  const ms = Date.parse(noTimezone ? d.replace(" ", "T") + "Z" : d);
  return Number.isFinite(ms) ? ms : null;
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

/** 按毫秒生成标签：间隔 >= 24h 用日期，否则用小时 */
function labelFor(ms: number, bucketHours: number): string {
  const dt = new Date(ms);
  if (bucketHours >= 24) return pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  return pad(dt.getUTCHours()) + ":00";
}

function keyFor(ms: number, bucketHours: number): string {
  return bucketHours >= 24 ? labelFor(ms, 24) : labelFor(ms, 24) + "T" + labelFor(ms, 1);
}

function intervalText(bucketHours: number): string {
  if (bucketHours < 24) return "每 " + bucketHours + " 小时";
  const days = bucketHours / 24;
  return days === 1 ? "每天" : "每 " + days + " 天";
}

/** 原始点的最小步长（毫秒）；不足两点时返回 null */
function rawStepMs(sorted: number[]): number | null {
  if (sorted.length < 2) return null;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < sorted.length; i++) {
    const step = sorted[i] - sorted[i - 1];
    if (step > 0 && step < min) min = step;
  }
  return Number.isFinite(min) ? min : null;
}

/** 降级路径：日期无法解析时，按索引等距抽样到 maxBars 根，保证不重合 */
function fallbackByIndex(points: SeriesPoint[], maxBars: number): AggregatedSeries {
  if (points.length <= maxBars) {
    return {
      buckets: points.map((p) => ({ key: p.date, label: p.date.slice(5, 10), value: p.newJobs })),
      intervalLabel: "原始粒度",
      aggregated: false,
      rawCount: points.length,
    };
  }
  const step = Math.ceil(points.length / maxBars);
  const buckets: SeriesBucket[] = [];
  for (let i = 0; i < points.length; i += step) {
    buckets.push({ key: points[i].date, label: points[i].date.slice(5, 10), value: points[i].newJobs });
  }
  const last = points[points.length - 1];
  if (buckets[buckets.length - 1]?.key !== last.date) {
    buckets.push({ key: last.date, label: last.date.slice(5, 10), value: last.newJobs });
  }
  return { buckets, intervalLabel: "等距抽样", aggregated: true, rawCount: points.length };
}

/**
 * 把原始时间序列聚合成"手机上能看清"的柱：
 * - 从 1h/2h/3h/6h/12h/1d/2d/3d/7d 里挑第一个柱数 <= maxBars 的间隔；
 * - 空区间补 0（保留真实时间分布，不要"跳着画"）；
 * - 日期无法解析时退回索引抽样。
 */
export function aggregateTimeSeries(points: SeriesPoint[], maxBars: number = MAX_BARS): AggregatedSeries {
  if (points.length === 0) {
    return { buckets: [], intervalLabel: "", aggregated: false, rawCount: 0 };
  }
  const parsed = points.map((p) => parsePointMs(p.date));
  if (parsed.some((ms) => ms === null)) return fallbackByIndex(points, maxBars);
  const times = parsed as number[];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const step = rawStepMs([...times].sort((a, b) => a - b));

  let bucketHours = LADDER_HOURS[LADDER_HOURS.length - 1];
  for (const h of LADDER_HOURS) {
    const bucketMs = h * HOUR_MS;
    const count = Math.floor((max - min) / bucketMs) + 1;
    if (count <= maxBars) { bucketHours = h; break; }
  }
  const bucketMs = bucketHours * HOUR_MS;
  const count = Math.floor((max - min) / bucketMs) + 1;
  if (count > maxBars) return fallbackByIndex(points, maxBars);

  const sums = new Array<number>(count).fill(0);
  for (let i = 0; i < points.length; i++) {
    const idx = Math.floor((times[i] - min) / bucketMs);
    if (idx >= 0 && idx < count) sums[idx] += points[i].newJobs;
  }
  const buckets: SeriesBucket[] = sums.map((value, idx) => {
    const ms = min + idx * bucketMs;
    return { key: keyFor(ms, bucketHours), label: labelFor(ms, bucketHours), value };
  });
  const aggregated = step === null ? bucketHours > 1 : bucketMs > step;
  return {
    buckets,
    intervalLabel: aggregated ? intervalText(bucketHours) : "原始粒度",
    aggregated,
    rawCount: points.length,
  };
}

/** 标签稀疏化：只保留首、尾与中间均匀的若干位（避免文字互相压住） */
export function labelPositions(count: number, wanted: number = 5): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  if (count <= wanted) { for (let i = 0; i < count; i++) out.add(i); return out; }
  const step = Math.ceil(count / wanted);
  for (let i = 0; i < count; i += step) out.add(i);
  out.add(count - 1);
  return out;
}
