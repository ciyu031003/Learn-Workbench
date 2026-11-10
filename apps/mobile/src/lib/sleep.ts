/**
 * 睡眠数据层（v2.3）
 *
 * 真机反馈（三件事）：
 *   ① 健康页读不到系统健康数据 → 只有「昨晚窗口」+ 单条记录，窗口一过就空；
 *   ② 手动只能记「昨晚」→ 没有按日期/多晚的存储；
 *   ③ 没有具体分析 → 只有小时数，没有阶段/评分/规律性。
 *
 * 本文件把睡眠拆成三层，全部可以脱离 UI 单测：
 *   存储层  lwb.sleep.v2 = JSON 数组（每晚一条 SleepNight），旧 lwb.sleep.v1 单条自动迁移；
 *   读取层  Android Health Connect SleepSession → 多晚（默认 30 天）聚合，阶段/清醒/效率齐备；
 *   分析层  纯函数：评分、统计、规律性、阶段切片、格式化。
 *
 * 设计约束（与看板「踩坑点」一致）：
 * - **绝不抛异常**：原生模块缺失 / 未授权 / 服务不可用 / 超时 / 脏数据 / 空结果全部收敛成
 *   SleepNightsResult，调用方只看 status，不需要 try/catch。
 * - **动态 import**：react-native-health-connect 是 Android 原生模块（TurboModule 在 import
 *   期就 getEnforcing），放到文件顶层会让 iOS/Web/单测直接炸；只在「运行时确认是 Android +
 *   真正要读」时 import，且整体包在 try/catch 里。
 * - **纯函数可单测**：聚合 / 去重 / 评分 / 统计都在本文件，不 import react-native；单测
 *   （src/lib/sleep.test.ts）只 mock AsyncStorage + react-native + health-connect。
 * - **旧 API 不废**：formatSleepHours / formatSleepHoursValue / isFreshSleepEntry /
 *   loadSleepEntry / saveSleepEntry / SleepEntry / SLEEP_STATUS_HINT / readSleepFromHealth /
 *   openSleepSettings 保持可用（wellness.tsx、sleep-sheet.tsx 还在用）。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toDateKey } from "@learn-workbench/shared/dates";

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/** v2.3 多晚存档键：JSON 数组（每晚一条，按 date 升序，最新在末尾） */
export const SLEEP_NIGHTS_STORAGE_KEY = "lwb.sleep.v2";
/** 旧单条存档键（只作为迁移来源保留，不再写入） */
export const LEGACY_SLEEP_STORAGE_KEY = "lwb.sleep.v1";
/** @deprecated 旧单条键名别名；v2.3 起请用 SLEEP_NIGHTS_STORAGE_KEY */
export const SLEEP_STORAGE_KEY = LEGACY_SLEEP_STORAGE_KEY;

/** 「昨晚」窗口：昨天 18:00 → 今天 12:00（本地时区） */
export const SLEEP_WINDOW_START_HOUR = 18;
export const SLEEP_WINDOW_END_HOUR = 12;

/** 单段/单日睡眠的物理上限（超过视为脏数据，丢弃而不是把指标撑爆） */
export const MAX_SLEEP_HOURS = 24;

/** Health Connect 睡眠读取权限（AndroidManifest 已声明，见 scripts/apply-android-native.mjs） */
export const SLEEP_READ_PERMISSION = "android.permission.health.READ_SLEEP";

/** 默认回溯天数（多晚读取） */
export const DEFAULT_SLEEP_READ_DAYS = 30;

/** 本机最多保留多少晚（单键不宜无限膨胀；400 晚约一年多） */
export const MAX_SLEEP_NIGHTS = 400;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** 旧「昨晚窗口」读取：最多翻几页 / 每页条数 */
const SLEEP_MAX_PAGES = 4;
const SLEEP_PAGE_SIZE = 100;
/** 多晚读取：30 天最多可能上千段，翻页上限放宽（每页 100，12 页 = 1200 段） */
const HEALTH_MAX_PAGES = 12;
const HEALTH_PAGE_SIZE = 100;
/** 单次原生调用超时：Health Connect 服务在部分机型上会长时间不回调 */
const SLEEP_TIMEOUT_MS = 6000;

/** 清醒次数参考上限（睡眠阶段切片 isNormal 用） */
const AWAKE_REFERENCE_MAX_COUNT = 2;
/** 清醒时长兜底参考（有阶段但拿不到次数时用）：不超过 20 分钟 */
const AWAKE_REFERENCE_MAX_MINUTES = 20;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/** 睡眠阶段时长（分钟）：深睡 / 浅睡 / REM / 清醒 */
export interface SleepStages {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}

/**
 * 一晚睡眠（v2.3 存储单位）。
 *
 * 时间口径：date 是**起床日**（本地 YYYY-MM-DD）——「昨晚睡、今天醒」记在今天。
 * durationMin 是**实际睡眠时长**（卧床扣除清醒），timeInBedMin 是卧床时长。
 */
export interface SleepNight {
  /** 起床日（本地 YYYY-MM-DD），存储主键 */
  date: string;
  /** 入睡时间（ISO） */
  bedtime: string;
  /** 起床时间（ISO） */
  wakeTime: string;
  /** 实际睡眠时长（分钟，不含清醒） */
  durationMin: number;
  /** 卧床时长（分钟，含清醒与中途醒来） */
  timeInBedMin: number;
  /** 阶段分钟数；没有分段数据时为 null（手动记录） */
  stages: SleepStages | null;
  /** 夜间清醒次数；没有数据为 null */
  awakeCount: number | null;
  /** 睡眠效率（%，0-100）；没有数据为 null */
  efficiencyPct: number | null;
  /** 数据来源：系统健康数据 / 手动填写 */
  source: "health" | "manual";
  /** 写入时间（ISO），同一天重复写入时以最新为准 */
  updatedAt: string;
}

/** 旧「一晚睡眠」条目（v1 存档格式，仅兼容保留） */
export interface SleepEntry {
  /** 起床日（本地 YYYY-MM-DD） */
  date: string;
  /** 睡眠小时数（保留 1 位小数，0 < hours ≤ 24） */
  hours: number;
  /** 数据来源：系统健康数据 / 手动填写 */
  source: "health" | "manual";
  /** 写入时间（ISO） */
  updatedAt: string;
}

/** 读取结果：失败也有明确原因，UI 据此给不同引导文案（不弹错误框） */
export type SleepHealthStatus = "ok" | "unsupported" | "unavailable" | "denied" | "no-data" | "error";

/** 旧单晚读取结果（readSleepFromHealth 的返回，保持兼容） */
export interface SleepHealthResult {
  ok: boolean;
  status: SleepHealthStatus;
  /** 成功时为「昨晚窗口内」的小时数（1 位小数） */
  hours: number | null;
  /** 参与聚合的有效会话段数 */
  sessions: number;
}

/** 多晚读取结果（readSleepNightsFromHealth） */
export interface SleepNightsResult {
  ok: boolean;
  status: SleepHealthStatus;
  /** 成功时按起床日升序（最新在末尾） */
  nights: SleepNight[];
  /** 失败/空结果的机器可读原因（同时给人看的一句话） */
  reason?: string;
  /** 原始 Health Connect 读取诊断（权限通过后始终带回，便于解释“为什么没有分期”） */
  diagnostics?: SleepHealthDiagnostics;
}

export interface SleepHealthDiagnostics {
  /** 查询窗口内原始 SleepSession 条数 */
  recordCount: number;
  /** 其中带 stages 的条数 */
  stageRecordCount: number;
  /** 最近一条会话的结束时间（ISO） */
  lastRecordAt: string | null;
}

/** Health Connect 返回的睡眠会话（只取聚合需要的字段，宽松接受原生脏数据） */
export interface SleepHealthRecord {
  startTime?: string | null;
  endTime?: string | null;
  stages?: readonly SleepHealthStage[] | null;
}

export interface SleepHealthStage {
  startTime?: string | null;
  endTime?: string | null;
  /** SleepStageType：0 UNKNOWN / 1 AWAKE / 2 SLEEPING / 3 OUT_OF_BED / 4 LIGHT / 5 DEEP / 6 REM */
  stage?: number | string | null;
}

/** 旧版单段会话（只保留两个时间点） */
export interface SleepSession {
  startTime: string;
  endTime: string;
}

/** 睡眠阶段种类（内部归并口径） */
export type SleepStageKind = "awake" | "light" | "deep" | "rem" | "unknown";

/** 阶段切片配色语义（UI 映射 token 用，不在这里写颜色） */
export type SleepStageTone = "awake" | "rem" | "light" | "deep";

export interface SleepStageSlice {
  key: SleepStageTone;
  label: string;
  minutes: number;
  /** 占卧床时长的百分比（4 片相加约为 100） */
  pct: number;
  tone: SleepStageTone;
  /** 参考区间文案，如「15-20%」「0-2 次」 */
  reference: string;
  /** 是否落在参考区间内 */
  isNormal: boolean;
  /** true = 由时长/效率估算，不是设备上报的分期 */
  estimated?: boolean;
}

export interface SleepRegularity {
  /** 参与计算的晚数（有效入睡时间） */
  sample: number;
  /** 入睡时间标准差（分钟，保留整数）；样本不足 2 晚为 null */
  stdevMin: number | null;
  label: "规律" | "一般" | "不规律" | "未知";
}

export interface SleepTrend {
  latestDate: string;
  latestDurationMin: number;
  /** 窗口内平均睡眠时长（分钟） */
  avgDurationMin: number;
  /** 最近一晚 - 平均（分钟，正数=变长） */
  deltaMin: number;
  direction: "up" | "down" | "flat";
}

export interface SleepStats {
  /** 窗口内晚数 */
  count: number;
  /** 实际生效的窗口天数（0 = 全部） */
  windowDays: number;
  avgDurationMin: number | null;
  avgEfficiencyPct: number | null;
  /** 平均深睡占比（% 卧床时长） */
  avgDeepPct: number | null;
  /** 平均 REM 占比（% 卧床时长） */
  avgRemPct: number | null;
  avgAwakeCount: number | null;
  /** 平均入睡时间（相对 22:00 的轴，分钟） */
  avgBedtimeMinutes: number | null;
  /** 平均入睡时间（HH:mm 文案） */
  avgBedtime: string | null;
  avgScore: number | null;
  regularity: SleepRegularity;
  trend: SleepTrend | null;
  latest: SleepNight | null;
  /** 兼容别名（lib/sleep-api.ts 的页面契约按这些字段读取）：与 avgEfficiencyPct 同义 */
  avgEfficiency: number | null;
  /** 兼容别名：与 regularity.stdevMin 同义 */
  regularityStdMin: number | null;
  /** 兼容别名：规律性文案；样本不足时给页面用的「记录不足」 */
  regularityLabel: string;
}

export interface ManualSleepNightInput {
  date: string;
  durationMin: number;
  bedtime?: string;
  wakeTime?: string;
  /** 可选分期补录：深睡分钟与 REM 分钟；两者都有效且不超总时长才启用 */
  deepMin?: number;
  remMin?: number;
  /** 可选：夜间清醒次数 */
  awakeCount?: number;
  /** 可选：睡眠效率（%）；不传且卧床 > 睡眠时自动计算 */
  efficiencyPct?: number;
}

export interface SleepNightsOptions {
  /** 回溯天数（1-180，默认 30） */
  days?: number;
  now?: Date;
  timeoutMs?: number;
  /** 未授权时是否主动弹系统授权框（自动读取用 false，用户点「去授权」时用 true） */
  requestPermission?: boolean;
}

/* ------------------------------------------------------------------ *
 * 小工具
 * ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseInstant(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

/** 本地日期键 + 天数偏移（跨月/跨年交给 Date 处理） */
function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const base = new Date(year, month - 1, day);
  base.setDate(base.getDate() + deltaDays);
  return toDateKey(base);
}

/** 本地日期键 + 时刻 → 毫秒时间戳 */
function localTimeOnDate(dateKey: string, hour: number, minute = 0): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

/** 分钟规整：非法 → null，负数/超上限夹住并取整 */
function toMinutes(value: unknown, max = MAX_SLEEP_HOURS * 60): number | null {
  if (!isFiniteNumber(value)) return null;
  return Math.round(clamp(value, 0, max));
}

/** 时间区间并集：重叠/相接的合并，避免同一段被两个 App 各写一次导致时长翻倍 */
export interface TimeInterval {
  start: number;
  end: number;
}

function mergeIntervals(intervals: readonly TimeInterval[]): TimeInterval[] {
  const valid: TimeInterval[] = [];
  for (const interval of intervals) {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end)) continue;
    if (interval.end <= interval.start) continue;
    valid.push({ start: interval.start, end: interval.end });
  }
  valid.sort((a, b) => a.start - b.start);
  const merged: TimeInterval[] = [];
  for (const current of valid) {
    const last = merged[merged.length - 1];
    if (last && current.start <= last.end) {
      if (current.end > last.end) last.end = current.end;
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  return merged;
}

function totalIntervalMs(intervals: readonly TimeInterval[]): number {
  let total = 0;
  for (const interval of intervals) total += interval.end - interval.start;
  return total;
}

/* ------------------------------------------------------------------ *
 * 格式化（兼容旧口径）
 * ------------------------------------------------------------------ */

/** 小时数规整：非有限值归 0，夹到 [0, 24]，保留 1 位小数 */
export function roundSleepHours(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  const clamped = Math.min(MAX_SLEEP_HOURS, Math.max(0, hours));
  return Math.round(clamped * 10) / 10;
}

/** 指标格/正文用的数值文案：null → 「—」，否则 1 位小数（7.5 / 8） */
export function formatSleepHoursValue(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "—";
  const rounded = roundSleepHours(hours);
  if (rounded <= 0) return "0";
  return String(rounded);
}

/** 「昨晚 X 小时」里的 X 小时文案：null → 「—」 */
export function formatSleepHours(hours: number | null | undefined): string {
  const value = formatSleepHoursValue(hours);
  return value === "—" ? value : value + " 小时";
}

/**
 * 分钟 → 中文时长（「7 小时 30 分」/「45 分钟」/「—」）。
 * 与 formatSleepHours 的区别：精确到分钟，不四舍五入到 0.1 小时。
 */
export function formatSleepMinutes(minutes: number | null | undefined): string {
  if (!isFiniteNumber(minutes) || minutes < 0) return "—";
  const total = Math.round(minutes);
  if (total <= 0) return "0 分钟";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours <= 0) return rest + " 分钟";
  if (rest === 0) return hours + " 小时";
  return hours + " 小时 " + rest + " 分";
}

/** 分钟 → 紧凑时长（「7h30m」/「8h」/「45m」/「—」），窄卡片用 */
export function formatSleepMinutesShort(minutes: number | null | undefined): string {
  if (!isFiniteNumber(minutes) || minutes < 0) return "—";
  const total = Math.round(minutes);
  if (total <= 0) return "0m";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours <= 0) return rest + "m";
  return rest === 0 ? hours + "h" : hours + "h" + rest + "m";
}

/** ISO → 本地 HH:mm（解析失败 → 「—」） */
export function formatClockTime(iso: string | null | undefined): string {
  const time = parseInstant(iso);
  if (time === null) return "—";
  const date = new Date(time);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return hours + ":" + minutes;
}

/** 一晚的实际睡眠小时数（1 位小数）；非法 → null */
export function sleepDurationHours(night: SleepNight | null | undefined): number | null {
  if (!night || !isFiniteNumber(night.durationMin) || night.durationMin <= 0) return null;
  return roundSleepHours(night.durationMin / 60);
}

/* ------------------------------------------------------------------ *
 * 手动输入解析（旧 API）
 * ------------------------------------------------------------------ */

/**
 * 手动输入解析：支持 7.5、7,5、7:30（七小时半）、7小时；
 * 非法/超范围返回 null（调用方给一句提示，不弹窗）。
 */
export function parseSleepHoursInput(input: string | null | undefined): number | null {
  const text = String(input ?? "")
    .trim()
    .replace(/[，,]/g, ".")
    .replace(/\s+/g, "");
  if (!text) return null;

  const clock = /^(\d{1,2})[:：](\d{1,2})$/.exec(text);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) return null;
    const total = hours + minutes / 60;
    if (!(total > 0) || total > MAX_SLEEP_HOURS) return null;
    return roundSleepHours(total);
  }

  const numeric = text.replace(/(小时|个小时|hours?|hrs?|h)$/i, "");
  if (!numeric || !/^\d+(\.\d+)?$/.test(numeric)) return null;
  const hours = Number(numeric);
  if (!Number.isFinite(hours) || !(hours > 0) || hours > MAX_SLEEP_HOURS) return null;
  return roundSleepHours(hours);
}

/** 手动输入 → 分钟（拒绝 0）；非法 → null */
export function parseSleepMinutesInput(input: string | null | undefined): number | null {
  const hours = parseSleepHoursInput(input);
  if (hours === null) return null;
  return Math.round(hours * 60);
}

/* ------------------------------------------------------------------ *
 * 跨午夜轴 / 规律性
 * ------------------------------------------------------------------ */

/**
 * 入睡时刻 → 连续轴（分钟，以 22:00 为 0 点）。
 *
 * 睡眠时间天然跨午夜（23:00 → 07:00），直接比 HH:mm 会把 23:30 和 00:30 判成「差 23 小时」。
 * 因此把 18:00-次日 06:00 映射成连续轴：18:00 = -240、22:00 = 0、23:00 = +60、
 * 00:30 = +150、06:00 = +480。白天（06:00-18:00）没有「入睡」语义，夹到 06:00。
 */
export function bedtimeMinutes(iso: string | null | undefined): number | null {
  const time = parseInstant(iso);
  if (time === null) return null;
  const date = new Date(time);
  const minutes = date.getHours() * 60 + date.getMinutes();
  let axis: number;
  if (minutes >= SLEEP_WINDOW_START_HOUR * 60) axis = minutes - SLEEP_WINDOW_START_HOUR * 60;
  else if (minutes < 6 * 60) axis = minutes + 6 * 60;
  else axis = 12 * 60;
  return Math.round(axis - 4 * 60);
}

/** 轴分钟 → HH:mm（与 bedtimeMinutes 互逆；null → null） */
export function clockFromBedtimeMinutes(axis: number | null | undefined): string | null {
  if (!isFiniteNumber(axis)) return null;
  const raw = Math.round(axis) + 240 + SLEEP_WINDOW_START_HOUR * 60;
  const minutesOfDay = ((raw % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(minutesOfDay / 60) % 24).padStart(2, "0");
  const minutes = String(minutesOfDay % 60).padStart(2, "0");
  return hours + ":" + minutes;
}

/**
 * 入睡规律性：入睡时间（轴分钟）的标准差。
 * 不超过 30 分钟「规律」、不超过 60「一般」、超过 60「不规律」；不足 2 晚返回「未知」。
 */
export function sleepRegularity(nights: readonly SleepNight[] | null | undefined): SleepRegularity {
  const values: number[] = [];
  if (Array.isArray(nights)) {
    for (const night of nights) {
      const axis = bedtimeMinutes(night?.bedtime);
      if (axis !== null) values.push(axis);
    }
  }
  if (values.length < 2) return { sample: values.length, stdevMin: null, label: "未知" };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdevMin = Math.round(Math.sqrt(variance));
  return {
    sample: values.length,
    stdevMin,
    label: stdevMin <= 30 ? "规律" : stdevMin <= 60 ? "一般" : "不规律",
  };
}

/* ------------------------------------------------------------------ *
 * 评分与阶段切片
 * ------------------------------------------------------------------ */

function rangeScore(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= low && value <= high) return 100;
  if (value < low) return clamp((value / Math.max(1, low)) * 100, 0, 100);
  return clamp(100 - ((value - high) / Math.max(1, high)) * 100, 0, 100);
}

/** 时长分（0-100）：7-9 小时满分，两端线性衰减，<4h 或 >12h 记 0 */
function durationComponent(minutes: number): number {
  if (!(minutes > 0)) return 0;
  if (minutes < 240) return clamp((minutes / 240) * 40, 0, 40);
  if (minutes < 360) return 40 + ((minutes - 240) / 120) * 20;
  if (minutes < 420) return 60 + ((minutes - 360) / 60) * 40;
  if (minutes <= 540) return 100;
  if (minutes <= 600) return 100 - ((minutes - 540) / 60) * 30;
  if (minutes <= 720) return 70 - ((minutes - 600) / 120) * 70;
  return 0;
}

/** 数据质量：measured = 设备上报分期；estimated = 由时长/效率推导（小米只同步总时长时使用） */
export type SleepDataQuality = "measured" | "estimated";

export interface EffectiveSleepMetrics {
  stages: SleepStages | null;
  awakeCount: number | null;
  efficiencyPct: number | null;
  quality: SleepDataQuality;
}

/**
 * 把「只有总时长/入睡/起床」的记录补成可展示的完整指标。
 *
 * 这不是把估算冒充设备数据：返回 quality=estimated，页面会标注「估算」。
 * 一旦 Health Connect 的分期记录可读，effectiveSleepMetrics 会直接采用 measured，不再估算。
 */
export function effectiveSleepMetrics(night: SleepNight | null | undefined): EffectiveSleepMetrics {
  if (!night) return { stages: null, awakeCount: null, efficiencyPct: null, quality: "estimated" };
  if (night.stages) {
    return {
      stages: night.stages,
      awakeCount: night.awakeCount,
      efficiencyPct: night.efficiencyPct,
      quality: "measured",
    };
  }
  const inBed = night.timeInBedMin > 0 ? night.timeInBedMin : night.durationMin;
  const sleep = clamp(night.durationMin, 0, inBed);
  if (!(inBed > 0) || !(sleep > 0)) {
    return { stages: null, awakeCount: night.awakeCount, efficiencyPct: night.efficiencyPct, quality: "estimated" };
  }
  const actualAwake = Math.max(0, inBed - sleep);
  // 以人群常见区间为锚点，按睡眠总时长做很小幅调整；只用于趋势参考。
  const deepRatio = sleep < 360 ? 0.16 : sleep > 540 ? 0.19 : 0.18;
  const remRatio = sleep < 360 ? 0.19 : sleep > 540 ? 0.22 : 0.21;
  const deep = Math.round(sleep * deepRatio);
  const rem = Math.round(sleep * remRatio);
  const awake = Math.max(5, Math.round(actualAwake > 0 ? actualAwake : sleep * 0.025));
  // 四段之和对齐卧床时长：无真实清醒段时，从浅睡里让出估算的清醒分钟。
  const light = Math.max(0, Math.round(inBed - deep - rem - awake));
  const awakeCount = night.awakeCount ?? Math.max(1, Math.min(6, Math.round(awake / 18)));
  const efficiencyPct =
    night.efficiencyPct ??
    (actualAwake > 2
      ? Math.round(clamp((sleep / inBed) * 100, 0, 100))
      : sleep >= 420 && sleep <= 540
        ? 94
        : sleep >= 360
          ? 91
          : 88);
  return {
    stages: { deep, light, rem, awake },
    awakeCount,
    efficiencyPct,
    quality: "estimated",
  };
}

export function sleepDataQuality(night: SleepNight | null | undefined): SleepDataQuality {
  return effectiveSleepMetrics(night).quality;
}

/** 阶段质量分（0-100）：深睡/REM 各占一半，参考区间 15-20% / 20-25%；无阶段 → null（权重重分配） */
function stageQualityComponent(night: SleepNight, stagesOverride?: SleepStages | null): number | null {
  const stages = stagesOverride ?? night.stages;
  if (!stages) return null;
  const total = night.timeInBedMin > 0 ? night.timeInBedMin : night.durationMin;
  if (!(total > 0)) return null;
  const deepPct = (stages.deep / total) * 100;
  const remPct = (stages.rem / total) * 100;
  return (rangeScore(deepPct, 15, 20) + rangeScore(remPct, 20, 25)) / 2;
}

/** 规律性分（0-100）：有历史标准差就用它，否则用「入睡时间离 23:00 多远」兜底 */
function regularityComponent(night: SleepNight, stdevMin: number | null): number | null {
  if (isFiniteNumber(stdevMin)) {
    if (stdevMin <= 30) return 100;
    if (stdevMin <= 60) return 70;
    if (stdevMin <= 90) return 40;
    return 10;
  }
  const axis = bedtimeMinutes(night.bedtime);
  if (axis === null) return null;
  const diff = Math.abs(axis - 60); // 目标 23:00
  if (diff <= 30) return 100;
  return clamp(100 - ((diff - 30) / 150) * 100, 0, 100);
}

/**
 * 综合睡眠分（0-100）：时长 50% + 深睡/REM 质量 30% + 效率 10% + 规律性 10%。
 *
 * 缺项（无阶段 / 无效率）时**按可得项重分配权重**，不会因为「手动记录没有阶段」就压成低分。
 * 第二参数可传历史规律性标准差（sleepRegularity），不传则用入睡时间兜底。
 */
export function sleepScore(
  night: SleepNight | null | undefined,
  context: { regularityStdevMin?: number | null } = {}
): number {
  if (!night) return 0;
  const durationMin = isFiniteNumber(night.durationMin)
    ? clamp(night.durationMin, 0, MAX_SLEEP_HOURS * 60)
    : 0;
  if (!(durationMin > 0)) return 0;
  // 超过 24h 的记录是设备时钟/脏数据，不能靠“估算分期”又把分数抬起来。
  if (durationMin >= MAX_SLEEP_HOURS * 60) return 0;

  const metrics = effectiveSleepMetrics(night);
  let weighted = durationComponent(durationMin) * 50;
  let weights = 50;

  const quality = stageQualityComponent(night, metrics.stages);
  if (quality !== null) {
    // 估算分期只给 14 分权重，避免「按时长推出来的完美深睡/REM」把分数顶满。
    const qualityWeight = metrics.quality === "measured" ? 30 : 14;
    weighted += quality * qualityWeight;
    weights += qualityWeight;
  }

  if (metrics.efficiencyPct !== null && isFiniteNumber(metrics.efficiencyPct)) {
    const efficiencyWeight = metrics.quality === "measured" ? 10 : 8;
    weighted += clamp(metrics.efficiencyPct, 0, 100) * efficiencyWeight;
    weights += efficiencyWeight;
  }

  const regularity = regularityComponent(night, context.regularityStdevMin ?? null);
  if (regularity !== null) {
    weighted += regularity * 10;
    weights += 10;
  }

  if (weights <= 0) return 0;
  // 无设备分期时最高 84 分：数据可信度不足，不能用满分误导用户。
  const cap = metrics.quality === "measured" ? 100 : 84;
  return Math.round(clamp(Math.min(weighted / weights, cap), 0, 100));
}

/** 评分文案（中性措辞，不做医疗判断） */
export function qualityLabel(score: number | null | undefined): string {
  if (!isFiniteNumber(score)) return "—";
  if (score >= 85) return "优秀";
  if (score >= 70) return "良好";
  if (score >= 55) return "一般";
  if (score >= 40) return "偏差";
  return "较差";
}

const STAGE_LABEL: Record<SleepStageTone, string> = {
  awake: "清醒",
  rem: "REM",
  light: "浅睡",
  deep: "深睡",
};

/** 阶段参考区间（占比按卧床时长口径；清醒按次数） */
const STAGE_REFERENCE: Record<SleepStageTone, string> = {
  awake: AWAKE_REFERENCE_MAX_COUNT + " 次以内",
  rem: "20-25%",
  light: "55-75%",
  deep: "15-20%",
};

/**
 * 阶段切片（饼图/条形图数据）：深睡 → 浅睡 → REM → 清醒 固定顺序。
 * pct 以卧床时长为分母（4 片相加约为 100）；isNormal 对照参考区间：
 * 深睡 15-20% / 浅睡 55-75% / REM 20-25% / 清醒 0-2 次（拿不到次数时按不超过 20 分钟）。
 * 没有设备分期时按时长/效率估算（estimated=true），页面必须显示「估算」。
 */
export function sleepStageSlices(night: SleepNight | null | undefined): SleepStageSlice[] {
  if (!night) return [];
  const metrics = effectiveSleepMetrics(night);
  const stages = metrics.stages;
  if (!stages) return [];
  const total = (night.timeInBedMin > 0 ? night.timeInBedMin : night.durationMin) || 0;
  if (!(total > 0)) return [];

  const pctOf = (minutes: number): number => Math.round((Math.max(0, minutes) / total) * 1000) / 10;
  const deepPct = pctOf(stages.deep);
  const lightPct = pctOf(stages.light);
  const remPct = pctOf(stages.rem);
  const awakeNormal =
    metrics.awakeCount !== null && isFiniteNumber(metrics.awakeCount)
      ? metrics.awakeCount <= AWAKE_REFERENCE_MAX_COUNT
      : stages.awake <= AWAKE_REFERENCE_MAX_MINUTES;
  const estimated = metrics.quality === "estimated";

  return [
    {
      key: "deep",
      label: STAGE_LABEL.deep,
      minutes: stages.deep,
      pct: deepPct,
      tone: "deep",
      reference: STAGE_REFERENCE.deep,
      isNormal: deepPct >= 15 && deepPct <= 20,
      estimated,
    },
    {
      key: "light",
      label: STAGE_LABEL.light,
      minutes: stages.light,
      pct: lightPct,
      tone: "light",
      reference: STAGE_REFERENCE.light,
      isNormal: lightPct >= 55 && lightPct <= 75,
      estimated,
    },
    {
      key: "rem",
      label: STAGE_LABEL.rem,
      minutes: stages.rem,
      pct: remPct,
      tone: "rem",
      reference: STAGE_REFERENCE.rem,
      isNormal: remPct >= 20 && remPct <= 25,
      estimated,
    },
    {
      key: "awake",
      label: STAGE_LABEL.awake,
      minutes: stages.awake,
      pct: pctOf(stages.awake),
      tone: "awake",
      reference: STAGE_REFERENCE.awake,
      isNormal: awakeNormal,
      estimated,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * 统计
 * ------------------------------------------------------------------ */

function average(values: readonly number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

/** 一晚的深睡/REM 占比（%，分母卧床时长）；无阶段时使用估算值 */
function stageShare(night: SleepNight, kind: "deep" | "rem"): number | null {
  const stages = effectiveSleepMetrics(night).stages;
  if (!stages) return null;
  const total = night.timeInBedMin > 0 ? night.timeInBedMin : night.durationMin;
  if (!(total > 0)) return null;
  return (stages[kind] / total) * 100;
}

/** 按起床日升序排序（同日期保留 updatedAt 最新的） */
function sortNights(nights: readonly SleepNight[]): SleepNight[] {
  return [...nights].sort((a, b) =>
    a.date === b.date ? a.updatedAt.localeCompare(b.updatedAt) : a.date.localeCompare(b.date)
  );
}

/** 最近一晚（数组按日期升序）；空 → null */
export function latestSleepNight(nights: readonly SleepNight[] | null | undefined): SleepNight | null {
  if (!Array.isArray(nights) || nights.length === 0) return null;
  let latest: SleepNight | null = null;
  for (const night of nights) {
    if (!night || !isDateKey(night.date)) continue;
    if (!latest || night.date > latest.date || (night.date === latest.date && night.updatedAt > latest.updatedAt)) {
      latest = night;
    }
  }
  return latest;
}

/**
 * 睡眠统计（最近 days 天，锚点是「最近一晚」而不是墙上时间——离线补记也能算对）。
 *
 * days 非法/不大于 0 → 统计全部传入的晚数。趋势 = 最近一晚时长 - 窗口平均。
 */
export function sleepStats(nights: readonly SleepNight[] | null | undefined, days = 7): SleepStats {
  const normalized: SleepNight[] = [];
  if (Array.isArray(nights)) {
    for (const raw of nights) {
      const night = normalizeSleepNight(raw);
      if (night) normalized.push(night);
    }
  }
  const ordered = sortNights(normalized);
  const latestAll = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  const effectiveDays = isFiniteNumber(days) && days > 0 ? Math.round(clamp(days, 1, 365)) : 0;

  const windowNights: SleepNight[] = [];
  if (latestAll) {
    const anchor = latestAll.date;
    const windowStartKey = effectiveDays > 0 ? shiftDateKey(anchor, -(effectiveDays - 1)) : null;
    for (const night of ordered) {
      if (windowStartKey !== null && night.date < windowStartKey) continue;
      if (night.date > anchor) continue;
      windowNights.push(night);
    }
  }

  const avgDurationMin = average(windowNights.map((night) => night.durationMin));
  // 小米等设备可能只同步总时长；统计口径与日详情一致，使用估算后的有效指标，
  // 否则周/月会把大面积 null 直接显示成「—」。
  const effectiveMetrics = windowNights.map((night) => effectiveSleepMetrics(night));
  const avgEfficiencyPct = average(
    effectiveMetrics.map((metrics) => metrics.efficiencyPct).filter((value): value is number => value !== null)
  );
  const avgDeepPct = average(
    windowNights.map((night) => stageShare(night, "deep")).filter((value): value is number => value !== null)
  );
  const avgRemPct = average(
    windowNights.map((night) => stageShare(night, "rem")).filter((value): value is number => value !== null)
  );
  const avgAwakeCount = average(
    effectiveMetrics.map((metrics) => metrics.awakeCount).filter((value): value is number => value !== null)
  );
  const avgBedtimeMinutes = average(
    windowNights.map((night) => bedtimeMinutes(night.bedtime)).filter((value): value is number => value !== null)
  );
  const avgScore = average(windowNights.map((night) => sleepScore(night)));
  const regularity = sleepRegularity(windowNights);
  const latest = latestSleepNight(windowNights);

  let trend: SleepTrend | null = null;
  if (latest && avgDurationMin !== null) {
    const deltaMin = Math.round(latest.durationMin - avgDurationMin);
    trend = {
      latestDate: latest.date,
      latestDurationMin: latest.durationMin,
      avgDurationMin,
      deltaMin,
      direction: Math.abs(deltaMin) < 15 ? "flat" : deltaMin > 0 ? "up" : "down",
    };
  }

  return {
    count: windowNights.length,
    windowDays: effectiveDays || windowNights.length,
    avgDurationMin,
    avgEfficiencyPct,
    avgDeepPct: avgDeepPct === null ? null : Math.round(avgDeepPct * 10) / 10,
    avgRemPct: avgRemPct === null ? null : Math.round(avgRemPct * 10) / 10,
    avgAwakeCount: avgAwakeCount === null ? null : Math.round(avgAwakeCount * 10) / 10,
    avgBedtimeMinutes: avgBedtimeMinutes === null ? null : Math.round(avgBedtimeMinutes),
    avgBedtime: clockFromBedtimeMinutes(avgBedtimeMinutes),
    avgScore: avgScore === null ? null : Math.round(avgScore),
    regularity,
    trend,
    latest,
    avgEfficiency: avgEfficiencyPct,
    regularityStdMin: regularity.stdevMin,
    regularityLabel: regularity.stdevMin === null ? "记录不足" : regularity.label,
  };
}

/* ------------------------------------------------------------------ *
 * 归一化
 * ------------------------------------------------------------------ */

/** 阶段分钟数收敛：四个字段齐全且总量 > 0 才算有效，否则 null */
export function normalizeSleepStages(raw: unknown): SleepStages | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SleepStages>;
  const deep = toMinutes(value.deep);
  const light = toMinutes(value.light);
  const rem = toMinutes(value.rem);
  const awake = toMinutes(value.awake);
  if (deep === null || light === null || rem === null || awake === null) return null;
  if (deep + light + rem + awake <= 0) return null;
  return { deep, light, rem, awake };
}

/** 把未知 JSON 收敛成合法的一晚（坏数据当没有）；timeInBed 至少等于实际睡眠时长 */
export function normalizeSleepNight(raw: unknown): SleepNight | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SleepNight>;
  if (!isDateKey(value.date)) return null;
  const bedtimeMs = parseInstant(value.bedtime);
  const wakeTimeMs = parseInstant(value.wakeTime);
  if (bedtimeMs === null || wakeTimeMs === null) return null;
  const durationMin = toMinutes(value.durationMin);
  if (durationMin === null || durationMin <= 0) return null;
  const inBedRaw = toMinutes(value.timeInBedMin);
  const timeInBedMin = inBedRaw !== null && inBedRaw >= durationMin ? inBedRaw : durationMin;
  const awakeCountRaw = toMinutes(value.awakeCount, 200);
  const efficiencyPct =
    isFiniteNumber(value.efficiencyPct) ? Math.round(clamp(value.efficiencyPct, 0, 100)) : null;

  return {
    date: value.date,
    bedtime: new Date(bedtimeMs).toISOString(),
    wakeTime: new Date(wakeTimeMs).toISOString(),
    durationMin,
    timeInBedMin,
    stages: normalizeSleepStages(value.stages),
    awakeCount: awakeCountRaw,
    efficiencyPct,
    source: value.source === "health" ? "health" : "manual",
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : new Date().toISOString(),
  };
}

/** 旧条目收敛（v1 存档） */
export function normalizeSleepEntry(raw: unknown): SleepEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SleepEntry>;
  const date = isDateKey(value.date) ? value.date : null;
  const hours = typeof value.hours === "number" && Number.isFinite(value.hours) ? value.hours : null;
  if (!date || hours === null) return null;
  const rounded = roundSleepHours(hours);
  if (rounded <= 0) return null;
  return {
    date,
    hours: rounded,
    source: value.source === "health" ? "health" : "manual",
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : new Date().toISOString(),
  };
}

/** 用当前时间算出「这一晚」的日期键（起床日 = 今天） */
export function sleepEntryDateKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** 本机睡眠值是否「还算昨晚的」（旧指标格逻辑，保持不变） */
export function isFreshSleepEntry(
  entry: SleepEntry | null | undefined,
  todayKey: string,
  yesterdayKey: string
): boolean {
  if (!entry) return false;
  return entry.date === todayKey || entry.date === yesterdayKey;
}

/* ------------------------------------------------------------------ *
 * 旧条目 → 新结构（迁移共用）
 * ------------------------------------------------------------------ */

/**
 * 旧条目（只有日期 + 小时数）→ SleepNight。
 * 没有入睡/起床时间，按「起床日 07:00 醒」反推；没有阶段，因此阶段/次数/效率都是 null。
 */
function sleepNightFromLegacyEntry(
  entry: SleepEntry,
  options: { source?: "health" | "manual"; updatedAt?: string } = {}
): SleepNight {
  const durationMin = Math.max(1, Math.round(entry.hours * 60));
  const wakeTimeMs = localTimeOnDate(entry.date, 7, 0);
  const bedtimeMs = wakeTimeMs - durationMin * MINUTE_MS;
  return {
    date: entry.date,
    bedtime: new Date(bedtimeMs).toISOString(),
    wakeTime: new Date(wakeTimeMs).toISOString(),
    durationMin,
    timeInBedMin: durationMin,
    stages: null,
    awakeCount: null,
    efficiencyPct: null,
    source: options.source ?? "manual",
    updatedAt: options.updatedAt ?? entry.updatedAt,
  };
}

/* ------------------------------------------------------------------ *
 * 存储（AsyncStorage）
 * ------------------------------------------------------------------ */

/** 串行化读-改-写：两个 Sheet 同时保存时不会互相覆盖 */
let storageLock: Promise<unknown> = Promise.resolve();

function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  const result = storageLock.then(task, task);
  storageLock = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/** 读 v2 数组（坏 JSON / 坏条目都跳过；同日取 updatedAt 最新） */
async function readNightsFromStorage(): Promise<SleepNight[]> {
  try {
    const raw = await AsyncStorage.getItem(SLEEP_NIGHTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byDate = new Map<string, SleepNight>();
    for (const item of parsed) {
      const night = normalizeSleepNight(item);
      if (!night) continue;
      const existing = byDate.get(night.date);
      if (!existing || night.updatedAt >= existing.updatedAt) byDate.set(night.date, night);
    }
    return sortNights([...byDate.values()]);
  } catch {
    return [];
  }
}

/** 写 v2 数组（只保留最近 MAX_SLEEP_NIGHTS 晚）；失败返回 false */
async function writeNightsToStorage(nights: readonly SleepNight[]): Promise<boolean> {
  try {
    const ordered = sortNights(nights);
    const capped = ordered.length > MAX_SLEEP_NIGHTS ? ordered.slice(ordered.length - MAX_SLEEP_NIGHTS) : ordered;
    await AsyncStorage.setItem(SLEEP_NIGHTS_STORAGE_KEY, JSON.stringify(capped));
    return true;
  } catch {
    return false;
  }
}

/** 读旧 v1 单条存档（迁移来源；坏数据 → null，不抛） */
export async function loadLegacySleepEntrySafely(): Promise<SleepEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_SLEEP_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSleepEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * 读多晚睡眠（按起床日升序，最新在末尾）。
 *
 * v2 为空时把旧 v1 单条迁移成一条 manual night 并写回 v2（旧键保留，不删——
 * 迁移失败也能再试；旧键很小，留着不影响性能）。
 */
export async function loadSleepNights(): Promise<SleepNight[]> {
  const stored = await readNightsFromStorage();
  if (stored.length > 0) return stored;
  return withStorageLock(async () => {
    // 双检：并发首读时只迁移一次
    const locked = await readNightsFromStorage();
    if (locked.length > 0) return locked;
    const legacy = await loadLegacySleepEntrySafely();
    if (!legacy) return [];
    const night = sleepNightFromLegacyEntry(legacy, { source: "manual" });
    await writeNightsToStorage([night]);
    return [night];
  });
}

/** 写一晚（按 date upsert，同日覆盖）；失败返回 null */
export async function saveSleepNight(night: SleepNight): Promise<SleepNight | null> {
  const normalized = normalizeSleepNight(night);
  if (!normalized) return null;
  return withStorageLock(async () => {
    const nights = await readNightsFromStorage();
    const next = nights.filter((item) => item.date !== normalized.date);
    next.push(normalized);
    const ok = await writeNightsToStorage(next);
    return ok ? normalized : null;
  });
}

/** 删除某天的一晚；没有该日期或写入失败 → false */
export async function deleteSleepNight(date: string): Promise<boolean> {
  if (!isDateKey(date)) return false;
  return withStorageLock(async () => {
    const nights = await readNightsFromStorage();
    const next = nights.filter((item) => item.date !== date);
    if (next.length === nights.length) return false;
    return writeNightsToStorage(next);
  });
}

/**
 * 手动记一晚（任意日期，不再限制「昨晚」）。
 *
 * 时间缺省规则：只给时长 → 起床时间默认当天 07:00，入睡 = 起床 - 时长；
 * 只给就寝时间 → 起床 = 就寝 + 时长；只给起床时间 → 入睡 = 起床 - 时长。
 * 两个都给但不自洽（间隔小于时长）→ 以时长为准重算入睡时间。
 */
export async function upsertManualSleepNight(input: ManualSleepNightInput): Promise<SleepNight | null> {
  if (!input || !isDateKey(input.date)) return null;
  const duration = toMinutes(input.durationMin);
  if (duration === null || duration <= 0) return null;

  const givenWake = parseInstant(input.wakeTime);
  const givenBed = parseInstant(input.bedtime);
  const durationMs = duration * MINUTE_MS;

  const wakeTimeMs = givenWake ?? (givenBed !== null ? givenBed + durationMs : localTimeOnDate(input.date, 7, 0));
  let bedtimeMs = givenBed ?? wakeTimeMs - durationMs;
  if (wakeTimeMs - bedtimeMs < durationMs) bedtimeMs = wakeTimeMs - durationMs;
  if (bedtimeMs >= wakeTimeMs) bedtimeMs = wakeTimeMs - durationMs;

  const timeInBedMin = Math.max(duration, Math.round((wakeTimeMs - bedtimeMs) / MINUTE_MS));
  const deepMin = toMinutes(input.deepMin);
  const remMin = toMinutes(input.remMin);
  const stageInputValid =
    deepMin !== null && remMin !== null && deepMin >= 0 && remMin >= 0 && deepMin + remMin <= duration;
  const stages: SleepStages | null = stageInputValid
    ? {
        deep: deepMin,
        rem: remMin,
        light: Math.max(0, duration - deepMin - remMin),
        awake: Math.max(0, timeInBedMin - duration),
      }
    : null;
  const awakeCount =
    isFiniteNumber(input.awakeCount) ? Math.round(clamp(input.awakeCount, 0, 30)) : null;
  const efficiencyPct = isFiniteNumber(input.efficiencyPct)
    ? Math.round(clamp(input.efficiencyPct, 0, 100))
    : timeInBedMin > duration
      ? Math.round(clamp((duration / timeInBedMin) * 100, 0, 100))
      : null;
  const night: SleepNight = {
    date: input.date,
    bedtime: new Date(bedtimeMs).toISOString(),
    wakeTime: new Date(wakeTimeMs).toISOString(),
    durationMin: duration,
    timeInBedMin,
    stages,
    awakeCount,
    efficiencyPct,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
  return saveSleepNight(night);
}

/** 读「最近一晚」（旧 API 兼容）：没有 → null */
export async function loadSleepEntry(): Promise<SleepEntry | null> {
  const nights = await loadSleepNights();
  const latest = latestSleepNight(nights);
  if (!latest) return null;
  return {
    date: latest.date,
    hours: roundSleepHours(latest.durationMin / 60),
    source: latest.source,
    updatedAt: latest.updatedAt,
  };
}

/**
 * 写「最近一晚」（旧 API 兼容）：写入/覆盖该日期的一晚。
 * 旧调用方传的是「今天」（起床日），所以等价于覆盖最近一晚。
 */
export async function saveSleepEntry(
  entry: Pick<SleepEntry, "date" | "hours" | "source"> & { updatedAt?: string }
): Promise<SleepEntry | null> {
  const normalized = normalizeSleepEntry({
    ...entry,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  });
  if (!normalized) return null;
  const night = sleepNightFromLegacyEntry(normalized, {
    source: normalized.source,
    updatedAt: normalized.updatedAt,
  });
  const saved = await saveSleepNight(night);
  if (!saved) return null;
  return {
    date: saved.date,
    hours: roundSleepHours(saved.durationMin / 60),
    source: saved.source,
    updatedAt: saved.updatedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Health Connect：单晚窗口（v2.0.1 旧 API，保持行为不变）
 * ------------------------------------------------------------------ */

type HealthConnectModule = typeof import("react-native-health-connect");

/** 给原生调用加超时：Health Connect 服务阻塞时不能让 Sheet 一直转圈 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("sleep-timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

function failure(status: SleepHealthStatus): SleepHealthResult {
  return { ok: false, status, hours: null, sessions: 0 };
}

/** 分页读完窗口内的睡眠会话（任何一条脏记录都跳过，不让整体失败） */
async function readSleepSessions(
  healthConnect: HealthConnectModule,
  startTime: string,
  endTime: string,
  timeoutMs: number
): Promise<SleepSession[]> {
  const sessions: SleepSession[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < SLEEP_MAX_PAGES; page += 1) {
    const result = await withTimeout(
      healthConnect.readRecords("SleepSession", {
        timeRangeFilter: { operator: "between", startTime, endTime },
        pageSize: SLEEP_PAGE_SIZE,
        ascendingOrder: true,
        ...(pageToken ? { pageToken } : {}),
      }),
      timeoutMs
    );
    for (const record of result?.records ?? []) {
      if (record && typeof record.startTime === "string" && typeof record.endTime === "string") {
        sessions.push({ startTime: record.startTime, endTime: record.endTime });
      }
    }
    pageToken = typeof result?.pageToken === "string" && result.pageToken ? result.pageToken : undefined;
    if (!pageToken) break;
  }
  return sessions;
}

/** 单段会话时长（小时）；脏数据 → null */
function sessionHours(session: SleepSession | null | undefined): number | null {
  if (!session) return null;
  const start = Date.parse(session.startTime);
  const end = Date.parse(session.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const hours = (end - start) / HOUR_MS;
  if (!(hours > 0) || hours > MAX_SLEEP_HOURS) return null;
  return hours;
}

/** 把多段睡眠会话聚合为小时数（空/脏数据安全，总量封顶 24h） */
export function aggregateSleepHours(sessions: readonly SleepSession[] | null | undefined): number {
  if (!Array.isArray(sessions)) return 0;
  let total = 0;
  for (const session of sessions) {
    const hours = sessionHours(session);
    if (hours !== null) total += hours;
  }
  return roundSleepHours(total);
}

/** 「昨晚」窗口：昨天 18:00 → 今天 12:00（本地时区；跨天由 Date 运算天然处理） */
export function lastNightWindow(now: Date = new Date()): { start: Date; end: Date } {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    start: new Date(todayMidnight.getTime() - (24 - SLEEP_WINDOW_START_HOUR) * HOUR_MS),
    end: new Date(todayMidnight.getTime() + SLEEP_WINDOW_END_HOUR * HOUR_MS),
  };
}

/**
 * 只统计「落在昨晚窗口内」的那部分睡眠（按重叠时长裁剪）。
 *
 * 为什么不直接按「整段时长」求和：Health Connect 里一段会话可能横跨窗口边界
 * （如 17:00→23:00、或 09:00→13:00），整段计入会把白天的补觉算进昨晚。
 * 裁剪后每段只贡献窗口内的部分，跨天（23:00→07:00）依旧是一整段、不重复计数。
 */
export function sleepHoursInWindow(
  sessions: readonly SleepSession[] | null | undefined,
  window: { start: Date; end: Date }
): number {
  if (!Array.isArray(sessions)) return 0;
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return 0;
  let total = 0;
  for (const session of sessions) {
    if (sessionHours(session) === null) continue;
    const start = Date.parse(session.startTime);
    const end = Date.parse(session.endTime);
    const overlapStart = Math.max(start, windowStart);
    const overlapEnd = Math.min(end, windowEnd);
    if (overlapEnd <= overlapStart) continue;
    total += (overlapEnd - overlapStart) / HOUR_MS;
  }
  return roundSleepHours(total);
}

/** 窗口内有效会话段数（UI 上用于「读到 N 段」的说明，也用于判断 no-data） */
export function countSessionsInWindow(
  sessions: readonly SleepSession[] | null | undefined,
  window: { start: Date; end: Date }
): number {
  if (!Array.isArray(sessions)) return 0;
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  let count = 0;
  for (const session of sessions) {
    if (sessionHours(session) === null) continue;
    const start = Date.parse(session.startTime);
    const end = Date.parse(session.endTime);
    if (Math.min(end, windowEnd) > Math.max(start, windowStart)) count += 1;
  }
  return count;
}

/**
 * 读取「昨晚」的系统睡眠时长（Android Health Connect，v2.0.1 旧 API）。
 *
 * 永不抛异常，失败原因收敛为：
 * - unsupported：非 Android（iOS/Web 没有 Health Connect）
 * - unavailable：本机没有 Health Connect（Android 13- 未安装 / 系统不支持 / 初始化失败）
 * - denied：没有 READ_SLEEP 权限（requestPermission 为 true 时才会弹系统授权框）
 * - no-data：有权但窗口内没有睡眠记录
 * - error：原生模块加载失败、超时、读取报错
 */
export async function readSleepFromHealth(
  options: {
    now?: Date;
    timeoutMs?: number;
    /** 是否在未授权时主动申请 READ_SLEEP（自动读取用 false，用户点「去授权」时用 true） */
    requestPermission?: boolean;
  } = {}
): Promise<SleepHealthResult> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? SLEEP_TIMEOUT_MS;
  const window = lastNightWindow(now);

  let healthConnect: HealthConnectModule;
  try {
    const { Platform } = await import("react-native");
    if (Platform.OS !== "android") return failure("unsupported");
    healthConnect = await import("react-native-health-connect");
  } catch {
    // 原生模块没进包（例如还没重新构建 APK）/ 非 Android 运行时
    return failure("unsupported");
  }

  try {
    const status = await withTimeout(healthConnect.getSdkStatus(), timeoutMs);
    const available = healthConnect.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
    if (status !== available) return failure("unavailable");

    const initialized = await withTimeout(healthConnect.initialize(), timeoutMs);
    if (!initialized) return failure("unavailable");

    const hasPermission = async () => {
      const granted = await withTimeout(healthConnect.getGrantedPermissions(), timeoutMs);
      return (granted ?? []).some(
        (permission) => permission?.accessType === "read" && permission?.recordType === "SleepSession"
      );
    };

    let granted = await hasPermission();
    if (!granted) {
      if (!options.requestPermission) return failure("denied");
      await withTimeout(
        healthConnect.requestPermission([{ accessType: "read", recordType: "SleepSession" }]),
        // 系统授权弹窗由用户操作，不能按读取超时掐断
        Math.max(timeoutMs, 120000)
      );
      granted = await hasPermission();
      if (!granted) return failure("denied");
    }

    const rangeStart = window.start;
    const rangeEnd = now.getTime() < window.end.getTime() ? now : window.end;
    if (rangeEnd.getTime() <= rangeStart.getTime()) return failure("no-data");

    const sessions = await readSleepSessions(
      healthConnect,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      timeoutMs
    );
    const count = countSessionsInWindow(sessions, window);
    const hours = sleepHoursInWindow(sessions, window);
    if (count === 0 || hours <= 0) return failure("no-data");
    return { ok: true, status: "ok", hours, sessions: count };
  } catch {
    return failure("error");
  }
}

/** 打开系统健康数据设置（Health Connect）。打不开返回 false，调用方给文案即可。 */
export async function openSleepSettings(): Promise<boolean> {
  try {
    const { Platform } = await import("react-native");
    if (Platform.OS !== "android") return false;
    const healthConnect: HealthConnectModule = await import("react-native-health-connect");
    healthConnect.openHealthConnectSettings();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Health Connect：多晚读取
 * ------------------------------------------------------------------ */

function nightsFailure(status: SleepHealthStatus, reason: string): SleepNightsResult {
  return { ok: false, status, nights: [], reason };
}

/** 把原生 stage 值（数字枚举或字符串）收敛成内部四类 + unknown */
export function sleepStageKind(raw: unknown): SleepStageKind | null {
  if (isFiniteNumber(raw)) {
    switch (raw) {
      case 0:
        return "unknown";
      case 1:
        return "awake";
      case 2:
        return "light";
      case 3:
        return "awake";
      case 4:
        return "light";
      case 5:
        return "deep";
      case 6:
        return "rem";
      default:
        return "unknown";
    }
  }
  if (typeof raw === "string") {
    const key = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (key === "awake") return "awake";
    if (key === "light" || key === "sleeping" || key === "nrem") return "light";
    if (key === "deep") return "deep";
    if (key === "rem") return "rem";
    if (key === "outofbed") return "awake";
    if (key === "unknown") return "unknown";
    return null;
  }
  return null;
}

/**
 * 原始 SleepSession 记录 → 按起床日归并的 SleepNight（纯函数，单测主入口）。
 *
 * 关键点：
 * - **起床日**：date 取会话结束时间（醒来）的本地日期，跨午夜（23:30→07:00）自然归到次日；
 * - **重叠去重**：同一段被小米运动健康 + Health Connect 各写一次时，时长/阶段/清醒次数都按
 *   **区间并集**计算，不会翻倍；两个 App 时间略有偏差的部分重叠也按并集算；
 * - **清醒扣除**：durationMin = 卧床并集 - AWAKE 并集，timeInBedMin 仍是卧床并集；
 * - 阶段缺失（只有 start/end）→ stages/awakeCount 为 null，效率仍可算。
 */
export function aggregateHealthSleepRecords(
  records: readonly SleepHealthRecord[] | null | undefined,
  options: { updatedAt?: string } = {}
): SleepNight[] {
  if (!Array.isArray(records)) return [];
  const updatedAt = options.updatedAt ?? new Date().toISOString();

  interface Bucket {
    date: string;
    intervals: TimeInterval[];
    stages: Record<Exclude<SleepStageKind, "unknown">, TimeInterval[]>;
  }

  const buckets = new Map<string, Bucket>();
  for (const record of records) {
    if (!record) continue;
    const start = parseInstant(record.startTime);
    const end = parseInstant(record.endTime);
    if (start === null || end === null || end <= start) continue;
    // 明显是脏记录（超过 24h，例如设备时钟错乱）直接丢
    if (end - start > MAX_SLEEP_HOURS * HOUR_MS) continue;

    const date = toDateKey(new Date(end));
    let bucket = buckets.get(date);
    if (!bucket) {
      bucket = { date, intervals: [], stages: { awake: [], light: [], deep: [], rem: [] } };
      buckets.set(date, bucket);
    }
    bucket.intervals.push({ start, end });

    if (Array.isArray(record.stages)) {
      for (const stage of record.stages) {
        const kind = sleepStageKind(stage?.stage);
        const stageStart = parseInstant(stage?.startTime);
        const stageEnd = parseInstant(stage?.endTime);
        if (kind === null || stageStart === null || stageEnd === null) continue;
        // 阶段可能被设备写成超出会话边界，裁到本条会话内
        const clippedStart = Math.max(stageStart, start);
        const clippedEnd = Math.min(stageEnd, end);
        if (clippedEnd <= clippedStart) continue;
        // UNKNOWN（未标注）/ SLEEPING（笼统入睡）没有独立桶，并入浅睡，避免时长凭空丢失
        const target: Exclude<SleepStageKind, "unknown"> = kind === "unknown" ? "light" : kind;
        bucket.stages[target].push({ start: clippedStart, end: clippedEnd });
      }
    }
  }

  const nights: SleepNight[] = [];
  for (const bucket of buckets.values()) {
    const bed = mergeIntervals(bucket.intervals);
    const inBedMs = totalIntervalMs(bed);
    if (!(inBedMs > 0)) continue;

    const stageIntervals = {
      awake: mergeIntervals(bucket.stages.awake),
      light: mergeIntervals(bucket.stages.light),
      deep: mergeIntervals(bucket.stages.deep),
      rem: mergeIntervals(bucket.stages.rem),
    };
    const awakeMs = totalIntervalMs(stageIntervals.awake);
    const sleepMs = Math.max(0, inBedMs - awakeMs);

    const hasStages =
      stageIntervals.awake.length > 0 ||
      stageIntervals.light.length > 0 ||
      stageIntervals.deep.length > 0 ||
      stageIntervals.rem.length > 0;

    const stages = hasStages
      ? {
          deep: Math.round(totalIntervalMs(stageIntervals.deep) / MINUTE_MS),
          light: Math.round(totalIntervalMs(stageIntervals.light) / MINUTE_MS),
          rem: Math.round(totalIntervalMs(stageIntervals.rem) / MINUTE_MS),
          awake: Math.round(awakeMs / MINUTE_MS),
        }
      : null;

    // 清醒次数 = 并集后的清醒区间数（至少 1 分钟才算一次，滤掉设备写的零碎毛刺）
    const awakeCount = hasStages
      ? stageIntervals.awake.filter((interval) => interval.end - interval.start >= MINUTE_MS).length
      : null;

    const inBedMin = Math.round(inBedMs / MINUTE_MS);
    const durationMin = Math.round(sleepMs / MINUTE_MS);
    if (!(durationMin > 0) || !(inBedMin > 0)) continue;

    nights.push({
      date: bucket.date,
      bedtime: new Date(bed[0].start).toISOString(),
      wakeTime: new Date(bed[bed.length - 1].end).toISOString(),
      durationMin,
      timeInBedMin: inBedMin,
      stages,
      awakeCount,
      efficiencyPct: inBedMin > 0 ? Math.round(clamp((durationMin / inBedMin) * 100, 0, 100)) : null,
      source: "health",
      updatedAt,
    });
  }

  return sortNights(nights);
}

/** 原始会话诊断：页面用它解释「有记录但没有分期」到底发生在哪一层 */
export function summarizeSleepHealthRecords(
  records: readonly SleepHealthRecord[] | null | undefined
): SleepHealthDiagnostics {
  const list = Array.isArray(records) ? records : [];
  let stageRecordCount = 0;
  let lastRecordAtMs: number | null = null;
  for (const record of list) {
    if (Array.isArray(record?.stages) && record.stages.length > 0) stageRecordCount += 1;
    const end = parseInstant(record?.endTime);
    if (end !== null && (lastRecordAtMs === null || end > lastRecordAtMs)) lastRecordAtMs = end;
  }
  return {
    recordCount: list.length,
    stageRecordCount,
    lastRecordAt: lastRecordAtMs === null ? null : new Date(lastRecordAtMs).toISOString(),
  };
}

/** 分页读完 [startTime, endTime] 内的睡眠会话（倒序：最新在前） */
async function readSleepRecordPages(
  healthConnect: HealthConnectModule,
  startTime: string,
  endTime: string,
  timeoutMs: number
): Promise<SleepHealthRecord[]> {
  const records: SleepHealthRecord[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < HEALTH_MAX_PAGES; page += 1) {
    const result = await withTimeout(
      healthConnect.readRecords("SleepSession", {
        timeRangeFilter: { operator: "between", startTime, endTime },
        pageSize: HEALTH_PAGE_SIZE,
        ascendingOrder: false,
        ...(pageToken ? { pageToken } : {}),
      }),
      timeoutMs
    );
    for (const record of result?.records ?? []) {
      records.push({
        startTime: record?.startTime ?? null,
        endTime: record?.endTime ?? null,
        stages: record?.stages ?? null,
      });
    }
    pageToken = typeof result?.pageToken === "string" && result.pageToken ? result.pageToken : undefined;
    if (!pageToken) break;
  }
  return records;
}

async function hasSleepPermission(healthConnect: HealthConnectModule, timeoutMs: number): Promise<boolean> {
  const granted = await withTimeout(healthConnect.getGrantedPermissions(), timeoutMs);
  return (granted ?? []).some(
    (permission) => permission?.accessType === "read" && permission?.recordType === "SleepSession"
  );
}

/**
 * 读取最近 days 天的系统睡眠（Android Health Connect），返回多晚。
 *
 * 永不抛异常，状态机：
 * unsupported（非 Android / 原生模块没进包）→ unavailable（SDK 不可用 / 初始化失败）
 * → denied（没有 READ_SLEEP）→ ok / no-data（有权但窗口内没有记录）→ error（超时/异常）。
 *
 * 查询窗口比「今天往前 days 天」多留 12 小时，用于捞「窗口前开始、窗口内结束」的会话；
 * 结果再按起床日裁剪到 [startKey, todayKey]。
 */
export async function readSleepNightsFromHealth(options: SleepNightsOptions = {}): Promise<SleepNightsResult> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? SLEEP_TIMEOUT_MS;
  const days = isFiniteNumber(options.days) ? Math.round(clamp(options.days, 1, 180)) : DEFAULT_SLEEP_READ_DAYS;
  const todayKey = toDateKey(now);
  const startKey = shiftDateKey(todayKey, -(days - 1));

  let healthConnect: HealthConnectModule;
  try {
    const { Platform } = await import("react-native");
    if (Platform.OS !== "android") return nightsFailure("unsupported", "本机不是 Android，没有 Health Connect");
    healthConnect = await import("react-native-health-connect");
  } catch {
    return nightsFailure("unsupported", "没有找到 Health Connect 原生模块（需要重新构建安装包）");
  }

  try {
    const sdkStatus = await withTimeout(healthConnect.getSdkStatus(), timeoutMs);
    const available = healthConnect.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
    if (sdkStatus !== available) return nightsFailure("unavailable", "系统不支持或未安装 Health Connect");

    const initialized = await withTimeout(healthConnect.initialize(), timeoutMs);
    if (!initialized) return nightsFailure("unavailable", "Health Connect 初始化失败");

    let permitted = await hasSleepPermission(healthConnect, timeoutMs);
    if (!permitted && options.requestPermission) {
      await withTimeout(
        healthConnect.requestPermission([{ accessType: "read", recordType: "SleepSession" }]),
        Math.max(timeoutMs, 120000)
      );
      permitted = await hasSleepPermission(healthConnect, timeoutMs);
    }
    if (!permitted) return nightsFailure("denied", "还没有睡眠读取权限");

    const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    rangeStart.setHours(rangeStart.getHours() - 12);
    const rangeEnd = now;
    if (rangeEnd.getTime() <= rangeStart.getTime()) return nightsFailure("no-data", "查询时间窗口为空");

    const records = await readSleepRecordPages(
      healthConnect,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      timeoutMs
    );
    const nights = aggregateHealthSleepRecords(records, { updatedAt: now.toISOString() }).filter(
      (night) => night.date >= startKey && night.date <= todayKey
    );
    const diagnostics = summarizeSleepHealthRecords(records);
    if (nights.length === 0) {
      return { ...nightsFailure("no-data", "系统里还没有这段时间的睡眠记录"), diagnostics };
    }
    return { ok: true, status: "ok", nights, diagnostics };
  } catch (error) {
    const timedOut = error instanceof Error && error.message === "sleep-timeout";
    return nightsFailure("error", timedOut ? "读取系统睡眠超时" : "读取系统睡眠失败");
  }
}

/* ------------------------------------------------------------------ *
 * 状态文案
 * ------------------------------------------------------------------ */

/** 各失败状态给用户看的一句话（统一口径，Sheet 与行动卡共用） */
export const SLEEP_STATUS_HINT: Record<SleepHealthStatus, string> = {
  ok: "已从系统健康数据读取睡眠记录",
  unsupported: "本机未提供健康数据，可手动记录",
  unavailable: "本机未提供健康数据，可手动记录",
  denied: "还没有睡眠读取权限，可手动记录或去授权",
  "no-data": "系统里还没有这段时间的睡眠记录，可手动记录",
  error: "读取系统睡眠失败，可手动记录或稍后重试",
};
