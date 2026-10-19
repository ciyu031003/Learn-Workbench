/**
 * Web Vitals 采集与首屏动效分档（S6-8）+ 弹窗/a11y 辅助判定（S6-5）。
 *
 * 隐私红线：
 *  - 只存**聚合计数/均值/最大值**，不存单条事件、不存 URL query、不存任何用户标识；
 *  - route 会做脱敏（数字/hex/uuid 段替换成 :id），避免把业务 ID 带进指标标签；
 *  - 采样：默认 20%，省流量/2G/低端机直接跳过（不额外消耗用户流量）。
 *
 * 之所以把纯函数与内存注册表放同一文件：server 端 route 与 client 端 reporter 共用同一套
 * 名称/评级/阈值定义，避免"上报口径与展示口径"各写一份。
 */

/* ============================== 契约（无 zod，客户端安全） ============================== */

// 说明：本文件同时被浏览器（vitals-reporter）与服务端（/api/internal/vitals）引用。
// 曾用 zod 定义采样契约，导致 zod（~63KB gzip）被打进所有首载 chunk（S6 发布实测）；
// 这里改为手写类型 + 解析函数，服务端同样做严格校验，客户端零额外依赖。

export const WEB_VITAL_NAMES = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;
export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];

export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number];

/** 单条采样：字段刻意少（服务端只做聚合，无用户维度） */
export interface WebVitalSample {
  name: WebVitalName;
  /** LCP/INP/FCP/TTFB 为毫秒；CLS 为无量纲分值 */
  value: number;
  rating: WebVitalRating;
  /** 已脱敏的路由（如 /tasks、/career/resume/:id） */
  route: string;
  navigationType?: string;
}

const MAX_VITAL_VALUE = 600_000;

/** 严格解析采样（服务端边界用）：非法返回 null，绝不抛异常 */
export function parseWebVitalSample(input: unknown): WebVitalSample | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const name = raw.name;
  if (typeof name !== "string" || !(WEB_VITAL_NAMES as readonly string[]).includes(name)) return null;
  const value = raw.value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_VITAL_VALUE) return null;
  const rating = raw.rating;
  if (typeof rating !== "string" || !(WEB_VITAL_RATINGS as readonly string[]).includes(rating)) return null;
  const route = raw.route;
  if (typeof route !== "string" || route.length < 1 || route.length > 80) return null;
  const navigationType = raw.navigationType;
  if (navigationType !== undefined && (typeof navigationType !== "string" || navigationType.length > 24)) return null;
  return { name: name as WebVitalName, value, rating: rating as WebVitalRating, route, navigationType };
}


/* ============================== 评级阈值 ============================== */

/**
 * Core Web Vitals 官方阈值（good 上限 / poor 下限）：
 * https://web.dev/articles/vitals —— 只在客户端算一次，服务端不重复判断阈值。
 */
const THRESHOLDS: Record<WebVitalName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

/** 按 Web Vitals 阈值把数值映射成 good / needs-improvement / poor */
export function rateVital(name: WebVitalName, value: number): WebVitalRating {
  const t = THRESHOLDS[name];
  if (!Number.isFinite(value) || value <= t.good) return "good";
  return value <= t.poor ? "needs-improvement" : "poor";
}

/* ============================== 采样 ============================== */

export const DEFAULT_VITAL_SAMPLE_RATE = 0.2;

export interface SamplingHints {
  saveData?: boolean;
  /** NetworkInformation.effectiveType，如 slow-2g / 3g / 4g */
  effectiveType?: string;
  hardwareConcurrency?: number;
  /** 注入随机数便于单测（0 <= random < 1） */
  random?: number;
  sampleRate?: number;
}

const SLOW_NETWORKS = new Set(["slow-2g", "2g"]);

/**
 * 是否上报本次 Web Vitals：
 *  - 省流量模式 / 2G：跳过（指标不值得再花用户流量）；
 *  - 低端机（<=4 核）：降采样到 1/3（低端机指标偏态严重，仍需要样本）；
 *  - 其余按 sampleRate（默认 20%）。
 */
export function shouldSampleVitals(hints: SamplingHints = {}): boolean {
  if (hints.saveData === true) return false;
  if (hints.effectiveType && SLOW_NETWORKS.has(hints.effectiveType)) return false;

  const random = typeof hints.random === "number" && hints.random >= 0 && hints.random < 1 ? hints.random : Math.random();
  const base = typeof hints.sampleRate === "number" && hints.sampleRate > 0 && hints.sampleRate <= 1
    ? hints.sampleRate
    : DEFAULT_VITAL_SAMPLE_RATE;
  const cores = hints.hardwareConcurrency;
  const rate = typeof cores === "number" && cores > 0 && cores <= 4 ? base / 3 : base;
  return random < rate;
}

/* ============================== 路由脱敏 ============================== */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX_RE = /\b[0-9a-f]{12,}\b/gi;
const NUM_RE = /\b\d{1,}\b/g;

/**
 * 把 pathname 脱敏成低基数标签：
 *  - 去掉 query / hash（可能带 token、筛选关键字等）；
 *  - uuid / 12+ 位 hex / 纯数字段 → :id；
 *  - 截断到 80 字符。
 */
export function sanitizeRoute(pathname: string): string {
  const clean = String(pathname || "/").split("?")[0].split("#")[0];
  const masked = clean.replace(UUID_RE, ":id").replace(HEX_RE, ":id").replace(NUM_RE, ":id");
  const normalized = masked.startsWith("/") ? masked : "/" + masked;
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

/* ============================== 动效分档 ============================== */

export type MotionTier = "full" | "reduced" | "none";

export interface MotionHints {
  prefersReducedMotion: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
}

/**
 * 首屏动效分档（S6-8）：
 *  - none：用户要求省流，或极低端（<=2 核 / <=1GB）——不跑装饰动画、不跑毛玻璃；
 *  - reduced：系统 reduced-motion，或低端（<=4 核 / <=2GB）——保留布局动效，关无限装饰动画；
 *  - full：其余。
 * 结果写到 html[data-motion]，由 globals.css 里的选择器降级（见 S6-5/6 段）。
 */
export function resolveMotionTier(hints: MotionHints): MotionTier {
  if (hints.prefersReducedMotion) return "reduced";
  if (hints.saveData === true) return "none";
  const cores = hints.hardwareConcurrency;
  const memory = hints.deviceMemory;
  if ((typeof cores === "number" && cores > 0 && cores <= 2) || (typeof memory === "number" && memory > 0 && memory <= 1)) {
    return "none";
  }
  if ((typeof cores === "number" && cores > 0 && cores <= 4) || (typeof memory === "number" && memory > 0 && memory <= 2)) {
    return "reduced";
  }
  return "full";
}

/* ============================== 内存聚合注册表 ============================== */

interface Aggregate {
  count: number;
  sum: number;
  max: number;
  ratings: Record<WebVitalRating, number>;
}

const EMPTY_RATINGS = (): Record<WebVitalRating, number> => ({ good: 0, "needs-improvement": 0, poor: 0 });

const REGISTRY = new Map<WebVitalName, Aggregate>();

/** 进程内聚合（单实例自用系统；重启清零，由 Prometheus 抓取累积） */
export function recordVital(sample: WebVitalSample): void {
  const existing = REGISTRY.get(sample.name) ?? {
    count: 0,
    sum: 0,
    max: 0,
    ratings: EMPTY_RATINGS(),
  };
  existing.count += 1;
  existing.sum += sample.value;
  existing.max = Math.max(existing.max, sample.value);
  existing.ratings[sample.rating] += 1;
  REGISTRY.set(sample.name, existing);
}

export interface VitalAggregateSnapshot {
  name: WebVitalName;
  count: number;
  avg: number;
  max: number;
  ratings: Record<WebVitalRating, number>;
}

export function vitalsSnapshot(): VitalAggregateSnapshot[] {
  return WEB_VITAL_NAMES.filter((name) => REGISTRY.has(name)).map((name) => {
    const agg = REGISTRY.get(name)!;
    return {
      name,
      count: agg.count,
      avg: agg.count > 0 ? agg.sum / agg.count : 0,
      max: agg.max,
      ratings: { ...agg.ratings },
    };
  });
}

/** 仅测试/代际切换使用 */
export function resetVitals(): void {
  REGISTRY.clear();
}

/** Prometheus 文本（GET /api/internal/vitals 输出，可与 /api/internal/metrics 一起抓） */
export function renderVitalsMetrics(): string {
  const lines: string[] = [
    "# HELP lwb_web_vitals_samples_total 浏览器 Web Vitals 采样条数（按指标 + 评级聚合，无用户维度）",
    "# TYPE lwb_web_vitals_samples_total counter",
  ];
  for (const snap of vitalsSnapshot()) {
    for (const rating of WEB_VITAL_RATINGS) {
      lines.push('lwb_web_vitals_samples_total{metric="' + snap.name + '",rating="' + rating + '"} ' + snap.ratings[rating]);
    }
  }
  lines.push("# HELP lwb_web_vitals_value_avg 浏览器 Web Vitals 平均值（LCP/INP/FCP/TTFB=毫秒，CLS=无量纲）");
  lines.push("# TYPE lwb_web_vitals_value_avg gauge");
  lines.push("# HELP lwb_web_vitals_value_max 浏览器 Web Vitals 最大值（同上单位）");
  lines.push("# TYPE lwb_web_vitals_value_max gauge");
  for (const snap of vitalsSnapshot()) {
    lines.push('lwb_web_vitals_value_avg{metric="' + snap.name + '"} ' + Number(snap.avg.toFixed(3)));
    lines.push('lwb_web_vitals_value_max{metric="' + snap.name + '"} ' + Number(snap.max.toFixed(3)));
  }
  return lines.join("\n") + "\n";
}
