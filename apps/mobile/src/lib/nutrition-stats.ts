import { fromDateKey, toDateKey } from "@learn-workbench/shared";
import { daysInMonth } from "@/lib/month-grid";
import type { DaySummaryRow } from "@/lib/nutrition-views";

/**
 * 饮食进阶可视化的**纯计算**（零 react-native import → 可单测，见看板踩坑点 48）。
 *
 * 覆盖 v4 P4-c 的前三项：
 *  1. 近 7 天热量曲线（含"上一周"对比序列、日均、峰值）
 *  2. 近 6 个月点阵热力图（列=周、行=星期，与 GitHub 贡献图同构）
 *  3. Food Calendar 的取数窗口与"当月有记录的日子"清单
 *
 * 数据来源全部是已有的 `GET /api/nutrition/summary?days=&end=`（逐日 kcal），
 * **零后端改动**：6 个月需要 6 次请求（后端单次上限 31 天），见 `monthWindowsBack` 的注释。
 */

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 从日期键往前推 n 天（本地日语义，跨夏令时不错位） */
function shiftKey(key: string, deltaDays: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + deltaDays);
  return toDateKey(d);
}

/** 星期几（0=周日），与 `monthGrid` 的"周日为第一列"保持一致 */
function weekdayOf(key: string): number {
  return fromDateKey(key).getDay();
}

export interface TrendPoint {
  key: string;
  /** 横轴标签：星期（日/一/…），7 天视图用星期比日期更好认 */
  label: string;
  kcal: number;
  logged: boolean;
}

export interface TrendSeries {
  /** 从早到晚的 7 天（最后一项 = endKey） */
  current: TrendPoint[];
  /** 上一周期同长度的 kcal（画虚线对比；缺失记 0） */
  prior: number[];
  totalKcal: number;
  /** 按**全部天数**平均（与「吃一点」的"Avg 1058 kcal"口径一致：7408/7） */
  avgKcal: number;
  /** 有记录的天数（口径提示：日均可能被没记录的天拉低） */
  daysLogged: number;
  peakKcal: number;
  peakKey: string | null;
  priorTotalKcal: number;
  /** 与上一周期相比的百分比；上一周期为 0 时返回 null（不显示"∞%"） */
  deltaPct: number | null;
}

/**
 * 近 `days` 天（默认 7）的热量趋势 + 与上一个同长周期的对比。
 * 窗口外的数据一律忽略 —— 调用方可能喂进来一整个月（月视图窗口）。
 */
export function buildTrendSeries(
  map: Record<string, DaySummaryRow>,
  endKey: string,
  days = 7
): TrendSeries {
  const current: TrendPoint[] = [];
  const prior: number[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = shiftKey(endKey, -i);
    const row = map[key];
    const logged = !!row && row.entryCount > 0;
    const kcal = logged ? Math.round(row!.kcal) : 0;
    current.push({ key, label: WEEKDAY_LABELS[weekdayOf(key)], kcal, logged });
  }
  for (let i = days * 2 - 1; i >= days; i -= 1) {
    const key = shiftKey(endKey, -i);
    const row = map[key];
    prior.push(row && row.entryCount > 0 ? Math.round(row.kcal) : 0);
  }

  const totalKcal = current.reduce((a, p) => a + p.kcal, 0);
  const priorTotalKcal = prior.reduce((a, v) => a + v, 0);
  const daysLogged = current.filter((p) => p.logged).length;
  let peakKcal = 0;
  let peakKey: string | null = null;
  for (const p of current) {
    if (p.kcal > peakKcal) {
      peakKcal = p.kcal;
      peakKey = p.key;
    }
  }

  return {
    current,
    prior,
    totalKcal,
    avgKcal: days > 0 ? Math.round(totalKcal / days) : 0,
    daysLogged,
    peakKcal,
    peakKey,
    priorTotalKcal,
    deltaPct: priorTotalKcal > 0 ? Math.round(((totalKcal - priorTotalKcal) / priorTotalKcal) * 100) : null,
  };
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * 热量档位（点阵/格子的深浅）。
 *
 * 为什么按 `reference`（用户的目标热量）而不是"区间最大值"分档：目标是固定的，
 * 于是"这个月比上个月吃得更多"在颜色上一眼可辨；用最大值分档会让每个月都被归一化，
 * 颜色失去跨月可比性。没有目标时才回落到区间最大值。
 */
export function heatLevel(kcal: number, reference: number): HeatLevel {
  if (!Number.isFinite(kcal) || kcal <= 0) return 0;
  const ref = Number.isFinite(reference) && reference > 0 ? reference : 0;
  if (ref <= 0) return 2;
  const ratio = kcal / ref;
  if (ratio < 0.34) return 1;
  if (ratio < 0.67) return 2;
  if (ratio < 1) return 3;
  return 4;
}

export interface HeatCell {
  /** 当天是否有记录（以 entryCount 为准；kcal 可能为 0） */
  logged?: boolean;
  key: string;
  kcal: number;
  level: HeatLevel;
  /** false = 该格超出了可见范围（未来的日子 / 网格对齐用的前置空位），渲染时留空 */
  inRange: boolean;
}

export interface HeatmapWeeks {
  /** 每列一周（7 行，行=周日→周六），列从左到右时间递增 */
  weeks: HeatCell[][];
  /** 月份刻度：`column` 是列下标 */
  monthLabels: { column: number; label: string }[];
  maxKcal: number;
  loggedDays: number;
}

/**
 * 近 `weeks` 周的点阵矩阵（列=周、行=周日→周六）。
 *
 * 对齐方式：最后一列是"包含 endKey 的那一周"，因此该列里 endKey 之后的格子标记为
 * `inRange: false`（未来），第一列之前不会有空位（起点直接由 endKey 反推）。
 *
 * `reference` 是分档参照（通常传用户的目标热量）：传了就用它分档（跨月可比），
 * 不传则回落到区间峰值。档位在这里算一次，渲染方直接用 `cell.level`，避免两处各算一套。
 */
export function buildHeatmapWeeks(
  map: Record<string, DaySummaryRow>,
  endKey: string,
  weeks = 26,
  reference = 0
): HeatmapWeeks {
  const safeWeeks = Math.max(1, Math.min(53, Math.floor(weeks) || 26));
  const endWeekday = weekdayOf(endKey);
  /** 最后一列的周日（往前后推 endWeekday 天） */
  const lastColumnSunday = shiftKey(endKey, -endWeekday);
  const firstColumnSunday = shiftKey(lastColumnSunday, -(safeWeeks - 1) * 7);

  const grid: HeatCell[][] = [];
  let maxKcal = 0;
  let loggedDays = 0;

  for (let w = 0; w < safeWeeks; w += 1) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const key = shiftKey(firstColumnSunday, w * 7 + d);
      const inRange = key <= endKey;
      const row = map[key];
      // "有记录"一律以 entryCount 为准（与 Food Calendar 口径一致）：
      // 手动录入但没填热量（kcal=0）也算记录过，否则点阵与月历会给出两个不同天数（审查发现）
      const logged = inRange && !!row && row.entryCount > 0;
      const kcal = logged ? Math.round(row!.kcal) : 0;
      if (logged) {
        loggedDays += 1;
        if (kcal > maxKcal) maxKcal = kcal;
      }
      column.push({ key, kcal, level: 0, inRange, logged });
    }
    grid.push(column);
  }

  const levelReference = reference > 0 ? reference : maxKcal > 0 ? maxKcal : 1;
  for (const column of grid) {
    for (const cell of column) {
      // 有记录但热量为 0（手动录入没填 kcal）→ 最低档 1，避免"记了却像没记"
      cell.level = (cell.logged ? Math.max(1, heatLevel(cell.kcal, levelReference)) : 0) as HeatLevel;
    }
  }

  // 月份刻度：列内"第一个在范围内"的日期所在月份发生变化时打一个标签，且至少隔 3 列避免拥挤
  const monthLabels: { column: number; label: string }[] = [];
  let lastLabelColumn = -99;
  let lastMonth = -1;
  for (let w = 0; w < grid.length; w += 1) {
    const anchor = grid[w].find((c) => c.inRange);
    if (!anchor) continue;
    const month = Number(anchor.key.slice(5, 7));
    if (month !== lastMonth) {
      lastMonth = month;
      if (w - lastLabelColumn >= 3) {
        monthLabels.push({ column: w, label: `${month}月` });
        lastLabelColumn = w;
      }
    }
  }

  return { weeks: grid, monthLabels, maxKcal, loggedDays };
}

export interface MonthWindow {
  y: number;
  m: number;
  /** 该窗口的天数（当月只到今天，所以不会把未来算进来） */
  days: number;
  /** 窗口最后一天（喂给 `summary?end=`） */
  end: string;
  key: string;
}

/**
 * 近 `months` 个月的取数窗口（**从旧到新**）。
 *
 * 为什么要按月拆：后端 `summary` 单次上限 31 天（`MAX_DAYS`），6 个月 ≈ 183 天没法一次拿完。
 * 拆成 6 次请求的取舍：① 每次请求都很小（只有逐日汇总，没有明细）；
 * ② 只在用户**打开趋势面板时**才发（懒加载），不拖慢饮食页首屏；
 * ③ 请求之间用 `Promise.all` 并发，6 个 RTT 并行 ≈ 单次的耗时。
 * 不用"31 天窗口往前滚 6 次"是因为那样相邻窗口会重叠（31 > 30/28），
 * 按自然月拆既无重叠又能精确得到"某月最后一天"作为锚点。
 */
export function monthWindowsBack(endKey: string, months = 6): MonthWindow[] {
  const safeMonths = Math.max(1, Math.min(24, Math.floor(months) || 6));
  const end = fromDateKey(endKey);
  const out: MonthWindow[] = [];
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const first = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    const isCurrent = i === 0;
    const days = isCurrent ? end.getDate() : daysInMonth(y, m);
    const last = new Date(y, m, days);
    out.push({ y, m, days, end: toDateKey(last), key: `${y}-${String(m + 1).padStart(2, "0")}` });
  }
  return out;
}

/** 合并多个月份的逐日汇总（键相同则后者覆盖，数值一致所以顺序无所谓） */
export function mergeSummaryMaps(maps: (Record<string, DaySummaryRow> | null | undefined)[]): Record<string, DaySummaryRow> {
  const out: Record<string, DaySummaryRow> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [key, row] of Object.entries(map)) out[key] = row;
  }
  return out;
}

/**
 * 某个月里"有记录"的日期键（新→旧），并截断到 `cap` 条。
 *
 * Food Calendar 的缩略图需要**每天的明细**，而后端只支持单日查询
 * （`GET /api/nutrition?date=`），所以只能按天补拉。这里先把范围收敛到
 * "该月真的有记录的天"，再用 `cap` 兜住最坏情况（31 天全有记录时的请求数）。
 */
export function loggedDaysInMonth(
  map: Record<string, DaySummaryRow>,
  y: number,
  m: number,
  cap = 24
): string[] {
  const prefix = `${y}-${String(m + 1).padStart(2, "0")}-`;
  const keys: string[] = [];
  const total = daysInMonth(y, m);
  for (let d = 1; d <= total; d += 1) {
    const key = `${prefix}${String(d).padStart(2, "0")}`;
    const row = map[key];
    if (row && row.entryCount > 0) keys.push(key);
  }
  keys.sort((a, b) => (a < b ? 1 : -1));
  return keys.slice(0, Math.max(0, cap));
}

/** 「与上一周期相比」的文案；无对比数据时返回 null */
export function formatDelta(deltaPct: number | null): string | null {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  if (deltaPct === 0) return "与上一周期持平";
  return `比上一周期${deltaPct > 0 ? "多" : "少"} ${Math.abs(deltaPct)}%`;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

/**
 * 规划"还需要补拉的日期明细"。
 *
 * Food Calendar 的缩略图需要**每天的条目**（食物名 → emoji 贴纸），而后端只支持单日
 * 查询（`GET /api/nutrition?date=`）→ 只能按天补拉。这里把请求集合收敛为：
 *   ① 只保留合法日期键；
 *   ② 去掉已经拉过的（`cached`）——翻月来回切不会重复打请求；
 *   ③ 按传入顺序截断到 `cap` 条 —— 最坏情况（整月 31 天都有记录）也不会打出 31 个并发。
 * 顺序由调用方决定（通常是"新→旧"），保证被截断时优先加载最近的日子。
 */
export function planDayEntryFetches(cached: string[], wanted: string[], cap = 24): string[] {
  const seen = new Set(cached.filter(isDateKey));
  const out: string[] = [];
  const limit = Math.max(0, Math.floor(cap) || 0);
  for (const key of wanted) {
    if (!isDateKey(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}
