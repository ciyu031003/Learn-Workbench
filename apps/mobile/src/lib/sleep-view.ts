/**
 * 睡眠详情页的纯视图函数（v2.3 睡眠详情页）
 *
 * 为什么单独成 lib：
 * - apps/mobile 的 vitest 只跑 "**\/*.test.ts"（environment: node），页面组件渲染不了；
 *   时长解析 / 评分兜底 / 统计口径 / 热力网格这些**边界最多**的部分必须能直接单测
 *   （看板踩坑 48：纯逻辑要从 react-native 里摘出来）。
 * - 数据层 lib/sleep.ts 由另一专题重写。本文件只做「展示与兜底」：
 *   它不认识 AsyncStorage / Health Connect，只处理已经拿到的 SleepNight 形状。
 *
 * 约定：所有函数对脏数据（NaN / 空串 / null / 缺字段）返回**可渲染**的结果，绝不抛异常。
 */

/** 一晚睡眠的数据形状（与数据层 SleepNight 结构一致；用结构类型，避免耦合导出名） */
export interface SleepStages {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}

export interface SleepNightLike {
  /** 起床日（本地 YYYY-MM-DD） */
  date: string;
  /** 入睡时刻（ISO）；手动记录可能为空串 */
  bedtime: string;
  wakeTime: string;
  durationMin: number;
  timeInBedMin: number;
  stages: SleepStages | null;
  awakeCount: number | null;
  efficiencyPct: number | null;
  source: "health" | "manual";
  updatedAt: string;
}

export interface SleepStatsLike {
  avgDurationMin: number | null;
  avgEfficiency: number | null;
  avgDeepPct: number | null;
  avgRemPct: number | null;
  avgAwakeCount: number | null;
  regularityStdMin: number | null;
  regularityLabel: string;
}

export interface SleepStageSliceLike {
  key: string;
  label: string;
  minutes: number;
  pct: number;
  /** 语义色调名（页面再映射成 theme token，禁止裸色值） */
  tone: string;
  /** 参考区间文案（数据层提供时优先用它的口径） */
  reference?: string;
  isNormal: boolean;
  /** true = 由时长估算，不是设备上报的分期 */
  estimated?: boolean;
}

/** 单日上限：超过 24h 的记录按 24h 计（脏数据不能把指标撑爆） */
export const MAX_SLEEP_MINUTES = 24 * 60;

/** NULL 的统一占位（全 App 一致） */
export const NO_VALUE = "—";

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!finite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1): number {
  if (!finite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

/* ------------------------------------------------------------------ *
 * 日期（本地时区；页面与测试同口径）
 * ------------------------------------------------------------------ */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 合法日期键（YYYY-MM-DD） */
export function isSleepDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

/** 日期键 → 本地 Date（00:00）；非法返回 null */
export function sleepDateOf(key: string): Date | null {
  if (!isSleepDateKey(key)) return null;
  const parts = key.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
    return null;
  }
  return date;
}

/** Date → 本地日期键 */
export function toSleepDateKey(date: Date): string {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

/** 日期键位移（跨月/跨年由 Date 处理） */
export function shiftSleepDate(key: string, days: number): string {
  const base = sleepDateOf(key) ?? new Date();
  return toSleepDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(days)));
}

/** 以 endKey 为终点的连续 N 天（升序，最后一项 = endKey） */
export function sleepKeyRange(endKey: string, days: number): string[] {
  const count = Math.max(1, Math.round(clampNumber(days, 1, 366)));
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(shiftSleepDate(endKey, -i));
  return out;
}

/** 单字星期（与健康页柱图同序：日 一 二 三 四 五 六） */
export function sleepWeekdayShort(key: string): string {
  const date = sleepDateOf(key);
  if (!date) return "";
  return ["日", "一", "二", "三", "四", "五", "六"][date.getDay()] ?? "";
}

/** 短日期：6/29（列标题 / 列表副标题） */
export function sleepMonthDay(key: string): string {
  if (!isSleepDateKey(key)) return "";
  return Number(key.slice(5, 7)) + "/" + Number(key.slice(8, 10));
}

/* ------------------------------------------------------------------ *
 * 时长解析 / 格式化
 * ------------------------------------------------------------------ */

/** 总时长输入解析：7.5 / 7,5 / 7:30 / 7h30m / 7小时30分 / 450 / 450 分钟 */
export function parseSleepDurationInput(input: string | null | undefined): number | null {
  const text = String(input ?? "")
    .trim()
    .replace(/[，,]/g, ".")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!text) return null;

  // 7:30（7 小时 30 分）
  const clock = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (!finite(hours) || !finite(minutes) || minutes >= 60) return null;
    const total = hours * 60 + minutes;
    if (!(total > 0) || total > MAX_SLEEP_MINUTES) return null;
    return Math.round(total);
  }

  // 7h30m / 7小时30分 / 7小时 / 7.5h
  const hoursForm = /^(\d+(?:\.\d+)?)(?:h|hr|hrs|小时|个小时)(?:(\d{1,2})(?:m|min|分钟|分)?)?$/.exec(text);
  if (hoursForm) {
    const hours = Number(hoursForm[1]);
    const minutes = hoursForm[2] ? Number(hoursForm[2]) : 0;
    if (!finite(hours) || !finite(minutes) || minutes >= 60) return null;
    const total = hours * 60 + minutes;
    if (!(total > 0) || total > MAX_SLEEP_MINUTES) return null;
    return Math.round(total);
  }

  // 450 分钟 / 90min
  const minutesForm = /^(\d{1,4})(?:m|min|mins|分钟|分)$/.exec(text);
  if (minutesForm) {
    const minutes = Number(minutesForm[1]);
    if (!(minutes > 0) || minutes > MAX_SLEEP_MINUTES) return null;
    return Math.round(minutes);
  }

  // 纯数字：小数或 ≤24 当小时，>24 的整数当分钟（450 → 450 分钟）
  const numeric = /^(\d+(?:\.\d+)?)$/.exec(text);
  if (!numeric) return null;
  const value = Number(numeric[1]);
  if (!finite(value) || !(value > 0)) return null;
  const total = value <= 24 ? value * 60 : value;
  if (!(total > 0) || total > MAX_SLEEP_MINUTES) return null;
  return Math.round(total);
}

/** 时长文案（数据层 formatSleepMinutes 缺席时的兜底）：7h32m / 48m */
export function sleepMinutesText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !finite(minutes) || minutes <= 0) return NO_VALUE;
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours <= 0) return rest + "m";
  return hours + "h" + pad2(rest) + "m";
}

/** 时钟文案（数据层 formatClockTime 缺席时的兜底）：ISO → 23:41；非法 → 「—」 */
export function sleepClockText(iso: string | null | undefined): string {
  if (typeof iso !== "string" || !iso) return NO_VALUE;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return NO_VALUE;
  const date = new Date(time);
  return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
}

/** 时钟串（HH:mm）→ 与起床日拼成 ISO；role 决定跨零点归属 */
export function sleepClockToIso(dateKey: string, clock: string, role: "bedtime" | "wakeTime"): string | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!finite(hours) || !finite(minutes) || hours > 23 || minutes > 59) return null;
  // 入睡：18:00 之后算「前一晚」；起床：一律记在起床日
  const dayOffset = role === "bedtime" && hours >= 18 ? -1 : 0;
  const base = sleepDateOf(shiftSleepDate(dateKey, dayOffset));
  if (!base) return null;
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

/* ------------------------------------------------------------------ *
 * 分期口径
 * ------------------------------------------------------------------ */

/** 各分期的参考区间（占总睡眠时间的百分比，宽松区间：只用来判断「明显偏低/偏高」） */
export const STAGE_REFERENCE: Record<string, { label: string; min: number; max: number; tone: string }> = {
  deep: { label: "深睡", min: 15, max: 60, tone: "lavender" },
  light: { label: "浅睡", min: 40, max: 70, tone: "primary" },
  rem: { label: "快速眼动", min: 15, max: 25, tone: "teal" },
  awake: { label: "清醒", min: 0, max: 10, tone: "accent" },
};

/** 分期总分钟（脏数据 → 0） */
export function sleepStageTotal(stages: SleepStages | null | undefined): number {
  if (!stages) return 0;
  return ["deep", "light", "rem", "awake"].reduce((sum, key) => {
    const value = (stages as unknown as Record<string, unknown>)[key];
    return sum + (typeof value === "number" && finite(value) && value > 0 ? value : 0);
  }, 0);
}

/** 某个分期占总睡眠时间（含清醒）的百分比 */
export function sleepStagePct(stages: SleepStages | null | undefined, key: keyof SleepStages): number | null {
  const total = sleepStageTotal(stages);
  if (!stages || total <= 0) return null;
  const value = stages[key];
  if (!finite(value) || value <= 0) return 0;
  return round((value / total) * 100, 1);
}

/** 参考区间文案：参考 15–60% */
export function stageReferenceText(key: string): string {
  const ref = STAGE_REFERENCE[key];
  if (!ref) return "";
  return "参考 " + ref.min + "–" + ref.max + "%";
}

/** 区间判断：偏低 / 正常 / 偏高 */
export function stageVerdict(key: string, pct: number): "偏低" | "正常" | "偏高" {
  const ref = STAGE_REFERENCE[key];
  if (!ref || !finite(pct)) return "正常";
  if (pct < ref.min) return "偏低";
  if (pct > ref.max) return "偏高";
  return "正常";
}

/** 兜底：分期占比切片（数据层 sleepStageSlices 缺席时使用） */
export function fallbackSleepStageSlices(night: SleepNightLike | null | undefined): SleepStageSliceLike[] {
  const stages = night?.stages ?? null;
  if (!stages) return [];
  const keys: (keyof SleepStages)[] = ["deep", "light", "rem", "awake"];
  const total = sleepStageTotal(stages);
  return keys.map((key) => {
    const ref = STAGE_REFERENCE[key];
    const raw = stages[key];
    const minutes = finite(raw) && raw > 0 ? Math.round(raw) : 0;
    const pct = total > 0 ? round((minutes / total) * 100, 1) : 0;
    return {
      key,
      label: ref ? ref.label : key,
      minutes,
      pct,
      tone: ref ? ref.tone : "primary",
      reference: stageReferenceText(key),
      isNormal: total > 0 ? stageVerdict(key, pct) === "正常" : false,
      estimated: false,
    };
  });
}

/* ------------------------------------------------------------------ *
 * 评分 / 统计（数据层缺席时的兜底）
 * ------------------------------------------------------------------ */

/** 评分评级文案（与数据层 qualityLabel 同档：85 / 70 / 55 / 40） */
export function sleepScoreRating(score: number | null | undefined): string {
  if (score === null || score === undefined || !finite(score)) return "暂无评分";
  if (score >= 85) return "优秀";
  if (score >= 70) return "良好";
  if (score >= 55) return "一般";
  if (score >= 40) return "偏差";
  return "较差";
}

/** 单晚评分兜底：时长 50% + 效率 20% + 深睡 15% + REM 15%（0–100） */
export function fallbackSleepScore(night: SleepNightLike | null | undefined): number {
  if (!night) return 0;
  const minutes = finite(night.durationMin) ? clampNumber(night.durationMin, 0, MAX_SLEEP_MINUTES) : 0;
  if (minutes <= 0) return 0;
  const hours = minutes / 60;
  // 8h 满分，每偏离 1h 扣 12 分（7h / 9h ≈ 88 分）
  const durationScore = clampNumber(100 - Math.abs(hours - 8) * 12, 0, 100);
  const efficiency =
    typeof night.efficiencyPct === "number" && finite(night.efficiencyPct)
      ? clampNumber(night.efficiencyPct, 0, 100)
      : 90;
  const efficiencyScore = clampNumber(((efficiency - 60) / 40) * 100, 0, 100);
  const deepPct = sleepStagePct(night.stages, "deep");
  const remPct = sleepStagePct(night.stages, "rem");
  const deepScore = deepPct === null ? 70 : clampNumber(100 - Math.abs(deepPct - 22) * 6, 0, 100);
  const remScore = remPct === null ? 70 : clampNumber(100 - Math.abs(remPct - 20) * 6, 0, 100);
  const score = durationScore * 0.5 + efficiencyScore * 0.2 + deepScore * 0.15 + remScore * 0.15;
  return Math.round(clampNumber(score, 0, 100));
}

/** 就寝时刻相对 24:00 的偏移（分钟）：23:30 → -30，00:30 → +30；非法 → null */
export function bedtimeOffsetMin(night: SleepNightLike | null | undefined): number | null {
  if (!night || typeof night.bedtime !== "string" || !night.bedtime) return null;
  const time = Date.parse(night.bedtime);
  if (!Number.isFinite(time)) return null;
  const date = new Date(time);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 12 * 60 ? minutes - 24 * 60 : minutes;
}

/** 就寝时刻的标准差（分钟）：<2 个有效值 → null（样本不足不给结论） */
export function bedtimeStdMin(offsets: readonly (number | null)[]): number | null {
  const values = offsets.filter((v): v is number => typeof v === "number" && finite(v));
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return round(Math.sqrt(variance), 0);
}

/** 规律性标签：≤30 分钟「规律」/ ≤60「一般」/ 其余「不规律」 */
export function regularityLabelOf(stdMin: number | null | undefined): string {
  if (stdMin === null || stdMin === undefined || !finite(stdMin)) return "记录不足";
  if (stdMin <= 30) return "规律";
  if (stdMin <= 60) return "一般";
  return "不规律";
}

function meanOf(values: readonly number[]): number | null {
  const safe = values.filter((v) => finite(v));
  if (safe.length === 0) return null;
  return round(safe.reduce((sum, v) => sum + v, 0) / safe.length, 1);
}

/** 兜底：区间统计（数据层 sleepStats 缺席时使用） */
export function fallbackSleepStats(
  nights: readonly SleepNightLike[] | null | undefined,
  days: number
): SleepStatsLike {
  const window = Math.max(1, Math.round(clampNumber(days, 1, 366)));
  const scoped = [...(Array.isArray(nights) ? nights : [])]
    .filter((night) => !!night && isSleepDateKey(night.date))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, window);

  const offsets = scoped.map((night) => bedtimeOffsetMin(night));
  const std = bedtimeStdMin(offsets);
  return {
    avgDurationMin: meanOf(scoped.map((night) => night.durationMin)),
    avgEfficiency: meanOf(
      scoped.map((night) => (typeof night.efficiencyPct === "number" ? night.efficiencyPct : NaN))
    ),
    avgDeepPct: meanOf(scoped.map((night) => sleepStagePct(night.stages, "deep") ?? NaN)),
    avgRemPct: meanOf(scoped.map((night) => sleepStagePct(night.stages, "rem") ?? NaN)),
    avgAwakeCount: meanOf(
      scoped.map((night) => (typeof night.awakeCount === "number" ? night.awakeCount : NaN))
    ),
    regularityStdMin: std,
    regularityLabel: regularityLabelOf(std),
  };
}

/* ------------------------------------------------------------------ *
 * 合并 / 窗口 / 热力
 * ------------------------------------------------------------------ */

/** 按日期倒序（新 → 旧），日期非法的条目排到最后 */
export function sortSleepNights<T extends { date: string }>(nights: readonly T[]): T[] {
  return [...nights].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 日期 → 条目（同日重复时后者覆盖前者） */
export function sleepNightMap<T extends { date: string }>(nights: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const night of nights) {
    if (night && isSleepDateKey(night.date)) map.set(night.date, night);
  }
  return map;
}

/**
 * 系统健康数据合并：**同日以 health 为准**（覆盖手动补录），手动记录里
 * 系统没有的日期原样保留。返回值按日期倒序。
 */
export function mergeHealthNights<T extends { date: string; source: string }>(
  local: readonly T[],
  health: readonly T[]
): T[] {
  const merged = sleepNightMap(local.filter((night) => night.source !== "health"));
  for (const night of health) {
    if (night && isSleepDateKey(night.date)) merged.set(night.date, night);
  }
  // 本机里已经是 health 的旧记录若系统这次没返回，也保留（可能超出读取窗口）
  for (const night of local) {
    if (night?.source === "health" && isSleepDateKey(night.date) && !merged.has(night.date)) {
      merged.set(night.date, night);
    }
  }
  return sortSleepNights([...merged.values()]);
}

/** 周柱图数据（升序：最早 → 今天） */
export interface SleepWeekColumn {
  key: string;
  /** 横轴标签（一 二 三 …） */
  label: string;
  minutes: number;
  night: SleepNightLike | null;
  highlight: boolean;
}

export function sleepWeekColumns(
  nights: readonly SleepNightLike[],
  endKey: string,
  days = 7
): SleepWeekColumn[] {
  const map = sleepNightMap(nights);
  return sleepKeyRange(endKey, days).map((key) => {
    const night = map.get(key) ?? null;
    return {
      key,
      label: sleepWeekdayShort(key),
      minutes: night && finite(night.durationMin) && night.durationMin > 0 ? Math.round(night.durationMin) : 0,
      night,
      highlight: key === endKey,
    };
  });
}

/** 月热力格 */
export interface SleepHeatCell {
  key: string;
  day: number;
  minutes: number;
  /** 0..steps */
  level: number;
  night: SleepNightLike | null;
}

/** 月热力（周一起，最后一行以 endKey 结束）：cells 补 null 到 7 的倍数 */
export interface SleepHeatWeeks {
  rows: (SleepHeatCell | null)[][];
  max: number;
  recordDays: number;
}

export function sleepHeatWeeks(
  nights: readonly SleepNightLike[],
  endKey: string,
  options: { days?: number; steps?: number; max?: number } = {}
): SleepHeatWeeks {
  const days = Math.max(1, Math.round(clampNumber(options.days ?? 30, 1, 366)));
  const steps = Math.max(1, Math.round(clampNumber(options.steps ?? 4, 1, 6)));
  const keys = sleepKeyRange(endKey, days);
  const map = sleepNightMap(nights);
  let recordDays = 0;
  let observedMax = 0;
  const minutesOf = (key: string): number => {
    const night = map.get(key);
    if (!night || !finite(night.durationMin) || night.durationMin <= 0) return 0;
    return Math.round(night.durationMin);
  };
  for (const key of keys) {
    const minutes = minutesOf(key);
    if (minutes > 0) {
      recordDays += 1;
      observedMax = Math.max(observedMax, minutes);
    }
  }
  const max = options.max !== undefined && finite(options.max) && options.max > 0 ? options.max : observedMax;

  // 周一对齐：把 startKey 之前的日子补 null
  const startDate = sleepDateOf(keys[0]);
  const lead = startDate ? (startDate.getDay() + 6) % 7 : 0;
  const cells: (SleepHeatCell | null)[] = new Array(lead).fill(null);
  for (const key of keys) {
    const minutes = minutesOf(key);
    const level =
      minutes <= 0 || max <= 0 ? 0 : Math.min(steps, Math.max(1, Math.ceil((minutes / max) * steps)));
    cells.push({
      key,
      day: Number(key.slice(8, 10)),
      minutes,
      level,
      night: map.get(key) ?? null,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (SleepHeatCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return { rows, max, recordDays };
}

/** 近 N 晚的平均钟点（周视图副标题用）：非法 → 「—」 */
export function averageClockText(nights: readonly SleepNightLike[], key: "bedtime" | "wakeTime"): string {
  const values = nights
    .map((night) => {
      const raw = night[key];
      if (typeof raw !== "string" || !raw) return null;
      const time = Date.parse(raw);
      if (!Number.isFinite(time)) return null;
      const date = new Date(time);
      return date.getHours() * 60 + date.getMinutes();
    })
    .filter((v): v is number => v !== null);
  if (values.length === 0) return NO_VALUE;
  const mean = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  const normalized = ((mean % (24 * 60)) + 24 * 60) % (24 * 60);
  return pad2(Math.floor(normalized / 60)) + ":" + pad2(normalized % 60);
}
