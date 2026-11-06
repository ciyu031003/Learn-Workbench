/**
 * 睡眠数据层**适配层**（v2.3 睡眠详情页）
 *
 * 背景：lib/sleep.ts 由另一专题重写为多晚模型（SleepNight / sleepScore / sleepStats …）。
 * 本文件是页面唯一的数据入口，职责只有两件：
 *  1. **按契约调用**：数据层一旦导出同名函数就原样使用（运行时探测，不做编译期硬绑定）；
 *  2. **最小兜底**：数据层尚未落地时，用旧版单条存档（loadSleepEntry / readSleepFromHealth）
 *     与 lib/sleep-view.ts 的纯函数把页面撑起来，保证任何时刻都能 typecheck / 跑页面。
 *
 * 约定（与父专题的接口契约一致，**不要改 lib/sleep.ts 的导出名**）：
 * - loadSleepNights(): Promise<SleepNight[]>                       按日期倒序
 * - readSleepNightsFromHealth({days?})                             系统健康数据（失败不抛）
 * - upsertManualSleepNight({date,durationMin,bedtime?,wakeTime?})  手动补录 / 订正
 * - deleteSleepNight(date)                                         删除某晚
 * - sleepScore(night) / sleepStats(nights, days) / sleepStageSlices(night)
 * - formatSleepMinutes(min) / formatClockTime(iso) / SLEEP_STATUS_HINT
 *
 * 数据层落地后，本文件可以整体退化为「转发 9 个导出」；兜底分支只在本机旧版本时生效。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { todayISO } from "@learn-workbench/shared/dates";
import * as sleepModule from "@/lib/sleep";
import {
  fallbackSleepScore,
  fallbackSleepStageSlices,
  fallbackSleepStats,
  isSleepDateKey,
  mergeHealthNights,
  NO_VALUE,
  sleepClockText,
  sleepMinutesText,
  sleepScoreRating,
  sortSleepNights,
  stageReferenceText,
  type SleepNightLike,
  type SleepStageSliceLike,
  type SleepStatsLike,
} from "./sleep-view";

export type SleepNight = SleepNightLike;
export type SleepStats = SleepStatsLike;
export type SleepStageSlice = SleepStageSliceLike;
export type SleepSource = SleepNight["source"];

/** 系统健康数据的读取结果（与契约同形） */
export type SleepHealthStatus = "ok" | "unsupported" | "unavailable" | "denied" | "no-data" | "error";

export interface SleepHealthRead {
  status: SleepHealthStatus;
  nights: SleepNight[];
}

export interface ManualSleepInput {
  date: string;
  durationMin: number;
  bedtime?: string;
  wakeTime?: string;
}

/** 数据层实际导出（全部可选：运行时探测，避免编译期硬绑定） */
interface SleepModuleShape {
  loadSleepNights?: () => Promise<unknown>;
  readSleepNightsFromHealth?: (options?: { days?: number; requestPermission?: boolean }) => Promise<unknown>;
  formatSleepMinutesShort?: (minutes: number) => unknown;
  qualityLabel?: (score: number) => unknown;
  upsertManualSleepNight?: (input: ManualSleepInput) => Promise<unknown>;
  deleteSleepNight?: (date: string) => Promise<unknown>;
  sleepScore?: (night: SleepNight) => unknown;
  sleepStats?: (nights: SleepNight[], days: number) => unknown;
  sleepStageSlices?: (night: SleepNight) => unknown;
  formatSleepMinutes?: (minutes: number) => unknown;
  formatClockTime?: (iso: string) => unknown;
  SLEEP_STATUS_HINT?: unknown;
  openSleepSettings?: () => Promise<unknown>;
  /** 旧版单条存档 API（兜底用） */
  loadSleepEntry?: () => Promise<unknown>;
  saveSleepEntry?: (entry: Record<string, unknown>) => Promise<unknown>;
  readSleepFromHealth?: (options?: Record<string, unknown>) => Promise<unknown>;
  SLEEP_STORAGE_KEY?: unknown;
}

const lib = sleepModule as unknown as SleepModuleShape;

/* ------------------------------------------------------------------ *
 * 文案（兜底 / 页面共用）
 * ------------------------------------------------------------------ */

/** 各读取状态的一句话（数据层 SLEEP_STATUS_HINT 缺席时的兜底；口径保持一致） */
export const SLEEP_STATUS_HINT_FALLBACK: Record<SleepHealthStatus, string> = {
  ok: "已从系统健康数据读取睡眠记录",
  unsupported: "本机未提供健康数据，可手动记录",
  unavailable: "本机未提供健康数据，可手动记录",
  denied: "还没有睡眠读取权限，可手动记录或去授权",
  "no-data": "系统里还没有睡眠记录，可手动记录",
  error: "读取系统睡眠失败，可手动记录",
};

/** 状态卡标题（短标签） */
export const SLEEP_STATUS_LABEL: Record<SleepHealthStatus, string> = {
  ok: "已连接",
  unsupported: "不可用",
  unavailable: "不可用",
  denied: "未授权",
  "no-data": "无数据",
  error: "异常",
};

/** 数据来源徽标 */
export const SLEEP_SOURCE_LABEL: Record<SleepSource, string> = {
  health: "系统健康",
  manual: "手动记录",
};

/** 小米运动健康的同步路径（用户最容易卡住的一步，UI 上直接写出来） */
export const XIAOMI_SYNC_HINT =
  "小米运动健康不会自动写入 Health Connect：请在「小米运动健康 → 我的 → 健康数据/第三方接入」里打开 Health Connect 同步，再回到这里点「重新读取」。";

/* ------------------------------------------------------------------ *
 * 归一（脏数据收敛，页面拿到的一定是合法形状）
 * ------------------------------------------------------------------ */

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeStages(raw: unknown): SleepNightLike["stages"] {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const deep = finiteOrNull(source.deep);
  const light = finiteOrNull(source.light);
  const rem = finiteOrNull(source.rem);
  const awake = finiteOrNull(source.awake);
  if (deep === null && light === null && rem === null && awake === null) return null;
  return {
    deep: Math.max(0, deep ?? 0),
    light: Math.max(0, light ?? 0),
    rem: Math.max(0, rem ?? 0),
    awake: Math.max(0, awake ?? 0),
  };
}

/** 单条归一：日期非法 / 时长 ≤ 0 视为脏数据（返回 null） */
export function normalizeSleepNight(raw: unknown): SleepNight | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const date = typeof value.date === "string" && isSleepDateKey(value.date) ? value.date : null;
  const durationRaw = finiteOrNull(value.durationMin);
  if (!date || durationRaw === null || durationRaw <= 0) return null;
  const durationMin = Math.round(durationRaw);
  const timeInBedRaw = finiteOrNull(value.timeInBedMin);
  return {
    date,
    bedtime: stringOr(value.bedtime),
    wakeTime: stringOr(value.wakeTime),
    durationMin,
    timeInBedMin: timeInBedRaw !== null && timeInBedRaw > 0 ? Math.round(timeInBedRaw) : durationMin,
    stages: normalizeStages(value.stages),
    awakeCount: finiteOrNull(value.awakeCount),
    efficiencyPct: finiteOrNull(value.efficiencyPct),
    source: value.source === "health" ? "health" : "manual",
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : new Date().toISOString(),
  };
}

/** 列表归一 + 按日期倒序 + 同日去重（后者覆盖前者） */
export function normalizeSleepNights(raw: unknown): SleepNight[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, SleepNight>();
  for (const item of raw) {
    const night = normalizeSleepNight(item);
    if (night) byDate.set(night.date, night);
  }
  return sortSleepNights([...byDate.values()]);
}

function normalizeStatus(raw: unknown): SleepHealthStatus {
  const allowed: SleepHealthStatus[] = ["ok", "unsupported", "unavailable", "denied", "no-data", "error"];
  return typeof raw === "string" && (allowed as string[]).includes(raw) ? (raw as SleepHealthStatus) : "error";
}

/* ------------------------------------------------------------------ *
 * 旧版存档 → 多晚模型（兜底）
 * ------------------------------------------------------------------ */

/** 旧版单条（{date,hours,source,updatedAt}）→ SleepNight */
function nightFromLegacyEntry(raw: unknown): SleepNight | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const hours = finiteOrNull(entry.hours);
  if (hours === null || hours <= 0) return null;
  return normalizeSleepNight({
    date: entry.date,
    bedtime: "",
    wakeTime: "",
    durationMin: Math.round(hours * 60),
    timeInBedMin: Math.round(hours * 60),
    stages: null,
    awakeCount: null,
    efficiencyPct: null,
    source: entry.source === "health" ? "health" : "manual",
    updatedAt: entry.updatedAt,
  });
}

/** 旧版「昨晚」读取结果（{ok,hours}）→ 今天这一晚 */
function nightFromLegacyHealth(raw: unknown): SleepNight | null {
  if (!raw || typeof raw !== "object") return null;
  const result = raw as Record<string, unknown>;
  if (result.ok !== true) return null;
  const hours = finiteOrNull(result.hours);
  if (hours === null || hours <= 0) return null;
  return normalizeSleepNight({
    date: todayISO(),
    durationMin: Math.round(hours * 60),
    timeInBedMin: Math.round(hours * 60),
    stages: null,
    awakeCount: null,
    efficiencyPct: null,
    source: "health",
    updatedAt: new Date().toISOString(),
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/* ------------------------------------------------------------------ *
 * 页面 API
 * ------------------------------------------------------------------ */

export const sleepApi = {
  /** 本机记录（按日期倒序）；数据层缺席时读旧版单条存档 */
  async loadSleepNights(): Promise<SleepNight[]> {
    if (typeof lib.loadSleepNights === "function") {
      try {
        return normalizeSleepNights(await lib.loadSleepNights());
      } catch {
        return [];
      }
    }
    try {
      const entry = typeof lib.loadSleepEntry === "function" ? await lib.loadSleepEntry() : null;
      const night = nightFromLegacyEntry(entry);
      return night ? [night] : [];
    } catch {
      return [];
    }
  },

  /** 读取系统健康数据（永不抛；失败由 status 表达） */
  async readSleepNightsFromHealth(options: { days?: number; requestPermission?: boolean } = {}): Promise<SleepHealthRead> {
    if (typeof lib.readSleepNightsFromHealth === "function") {
      try {
        const raw = asRecord(await lib.readSleepNightsFromHealth(options));
        const status = normalizeStatus(raw?.status);
        const nights = normalizeSleepNights(raw?.nights);
        return { status, nights };
      } catch {
        return { status: "error", nights: [] };
      }
    }
    // 旧版：只读「昨晚」窗口
    try {
      if (typeof lib.readSleepFromHealth !== "function") return { status: "unsupported", nights: [] };
      const raw = asRecord(await lib.readSleepFromHealth({ requestPermission: false }));
      const status = normalizeStatus(raw?.status);
      const night = nightFromLegacyHealth(raw);
      return { status, nights: night ? [night] : [] };
    } catch {
      return { status: "error", nights: [] };
    }
  },

  /** 手动补录 / 订正（同日期覆盖）；失败返回 null */
  async upsertManualSleepNight(input: ManualSleepInput): Promise<SleepNight | null> {
    if (typeof lib.upsertManualSleepNight === "function") {
      try {
        return normalizeSleepNight(await lib.upsertManualSleepNight(input));
      } catch {
        return null;
      }
    }
    try {
      if (typeof lib.saveSleepEntry !== "function") return null;
      const saved = await lib.saveSleepEntry({
        date: input.date,
        hours: Math.round(input.durationMin) / 60,
        source: "manual",
      });
      return nightFromLegacyEntry(saved);
    } catch {
      return null;
    }
  },

  /** 删除某晚；失败不抛（页面重载后仍是旧数据，会自然回到真实状态） */
  async deleteSleepNight(date: string): Promise<void> {
    if (typeof lib.deleteSleepNight === "function") {
      try {
        await lib.deleteSleepNight(date);
        return;
      } catch {
        return;
      }
    }
    // 旧版本机只有一条存档：删掉的只能是它
    const key = typeof lib.SLEEP_STORAGE_KEY === "string" ? lib.SLEEP_STORAGE_KEY : null;
    if (!key) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // 删不掉就当没删；页面会用 load 的真实结果覆盖
    }
  },

  /** 睡眠评分 0–100 */
  sleepScore(night: SleepNight | null | undefined): number {
    if (!night) return 0;
    if (typeof lib.sleepScore === "function") {
      try {
        const value = finiteOrNull(lib.sleepScore(night));
        if (value !== null) return Math.round(Math.min(100, Math.max(0, value)));
      } catch {
        // 落到兜底
      }
    }
    return fallbackSleepScore(night);
  },

  /** 区间统计 */
  sleepStats(nights: readonly SleepNight[], days: number): SleepStats {
    const scoped = [...nights];
    if (typeof lib.sleepStats === "function") {
      try {
        const raw = asRecord(lib.sleepStats(scoped, days));
        if (raw) {
          const fallback = fallbackSleepStats(scoped, days);
          return {
            avgDurationMin: finiteOrNull(raw.avgDurationMin) ?? fallback.avgDurationMin,
            avgEfficiency: finiteOrNull(raw.avgEfficiency) ?? fallback.avgEfficiency,
            avgDeepPct: finiteOrNull(raw.avgDeepPct) ?? fallback.avgDeepPct,
            avgRemPct: finiteOrNull(raw.avgRemPct) ?? fallback.avgRemPct,
            avgAwakeCount: finiteOrNull(raw.avgAwakeCount) ?? fallback.avgAwakeCount,
            regularityStdMin: finiteOrNull(raw.regularityStdMin) ?? fallback.regularityStdMin,
            regularityLabel: textOr(raw.regularityLabel, fallback.regularityLabel),
          };
        }
      } catch {
        // 落到兜底
      }
    }
    return fallbackSleepStats(scoped, days);
  },

  /** 分期占比切片（无 stages → 空数组） */
  sleepStageSlices(night: SleepNight | null | undefined): SleepStageSlice[] {
    if (!night) return [];
    if (typeof lib.sleepStageSlices === "function") {
      try {
        const raw = lib.sleepStageSlices(night);
        if (Array.isArray(raw) && raw.length > 0) {
          const normalized = raw
            .map((item) => {
              const slice = asRecord(item);
              if (!slice) return null;
              const minutes = finiteOrNull(slice.minutes) ?? 0;
              const pct = finiteOrNull(slice.pct) ?? 0;
              const key = textOr(slice.key, "");
              if (!key) return null;
              return {
                key,
                label: textOr(slice.label, key),
                minutes: Math.max(0, Math.round(minutes)),
                pct: Math.max(0, Math.min(100, pct)),
                tone: textOr(slice.tone, "primary"),
                reference: textOr(slice.reference, stageReferenceText(key)),
                isNormal: slice.isNormal === true,
              } satisfies SleepStageSlice;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
          if (normalized.length > 0) return normalized;
        }
      } catch {
        // 落到兜底
      }
    }
    return fallbackSleepStageSlices(night);
  },

  /** 时长文案：7h32m */
  formatSleepMinutes(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return NO_VALUE;
    if (typeof lib.formatSleepMinutes === "function") {
      try {
        return textOr(lib.formatSleepMinutes(minutes), sleepMinutesText(minutes));
      } catch {
        // 落到兜底
      }
    }
    return sleepMinutesText(minutes);
  },

  /** 紧凑时长文案：7h30m（指标格 / 列表行 / 输入框预填用） */
  formatSleepMinutesShort(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return NO_VALUE;
    if (typeof lib.formatSleepMinutesShort === "function") {
      try {
        return textOr(lib.formatSleepMinutesShort(minutes), sleepMinutesText(minutes));
      } catch {
        // 落到兜底
      }
    }
    return sleepMinutesText(minutes);
  },

  /** 评分评级文案（与数据层同一口径；缺席时用本地分档） */
  qualityLabel(score: number | null | undefined): string {
    if (score === null || score === undefined) return "暂无评分";
    if (typeof lib.qualityLabel === "function") {
      try {
        return textOr(lib.qualityLabel(score), "暂无评分");
      } catch {
        // 落到兜底
      }
    }
    return sleepScoreRating(score);
  },

  /** 时钟文案：23:41 */
  formatClockTime(iso: string | null | undefined): string {
    if (typeof lib.formatClockTime === "function") {
      try {
        return textOr(lib.formatClockTime(iso ?? ""), sleepClockText(iso));
      } catch {
        // 落到兜底
      }
    }
    return sleepClockText(iso);
  },

  /** 读取失败的一句话 */
  statusHint(status: SleepHealthStatus | null | undefined): string {
    if (!status) return "还没有读取系统健康数据，点「重新读取」试一次";
    const hints = asRecord(lib.SLEEP_STATUS_HINT);
    const value = hints?.[status];
    return typeof value === "string" && value ? value : SLEEP_STATUS_HINT_FALLBACK[status];
  },

  /** 打开系统健康数据设置（Health Connect）；打不开返回 false */
  async openSleepSettings(): Promise<boolean> {
    if (typeof lib.openSleepSettings === "function") {
      try {
        return (await lib.openSleepSettings()) === true;
      } catch {
        return false;
      }
    }
    return false;
  },
};

/** 合并（页面载入时用；health 优先覆盖同日 manual） */
export { mergeHealthNights };
