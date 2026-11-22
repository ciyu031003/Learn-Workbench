import { lastSevenKeys, weekdayShort } from "./growth-format";

/**
 * 成长概览层的**纯计算**（零 React / 零 react-native 运行期依赖 → 可直接单测）。
 *
 * 只回答两个问题，页面不再自己拼口径：
 *  1) 今日完成度：习惯 / 运动 / 饮水 / 饮食 四项各自达成率的平均（缺项不参与分母，绝不把「没记录」当 0）；
 *  2) 本周状态：近 7 天哪几天有记录（饮水或饮食任一有记录即算），今天单独标记。
 *
 * 数据来源与旧版成长页完全一致（/api/daily、/api/wellbeing/hydration、/api/nutrition/summary），
 * 这里不新增接口、不编造数据。
 */

export type GrowthMetricKey = "habits" | "exercise" | "water" | "diet";

export interface GrowthMetric {
  key: GrowthMetricKey;
  label: string;
  /** 0..1；null = 该项今天没有数据（展示为「—」） */
  ratio: number | null;
}

export interface GrowthCompletion {
  metrics: GrowthMetric[];
  /** 有数据项的平均完成度 0..1；全无数据 = null */
  ratio: number | null;
  /** 百分比整数 0..100；全无数据 = null */
  percent: number | null;
  /** 达标项数（ratio ≥ 1 的项） */
  achieved: number;
}

export interface GrowthCompletionInput {
  habitsDone: number | null;
  habitsScheduled: number | null;
  exerciseMinutes: number | null;
  /** 训练目标分钟，默认 30（与旧版一致） */
  exerciseTargetMinutes?: number;
  waterMl: number | null;
  waterTargetMl: number | null;
  kcal: number | null;
  kcalTargetKcal: number | null;
}

/** 达成率：任一侧缺数据 / 目标非正 → null（不参与平均，也不显示 0%） */
export function completionRatio(value: number | null, target: number | null): number | null {
  if (value === null || target === null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return null;
  return Math.max(0, Math.min(1, value / target));
}

/** 今日完成度（四项平均；只把「有数据」的项计入分母） */
export function buildCompletion(input: GrowthCompletionInput): GrowthCompletion {
  const targetMinutes = input.exerciseTargetMinutes ?? 30;
  const metrics: GrowthMetric[] = [
    {
      key: "habits",
      label: "习惯",
      ratio: completionRatio(input.habitsDone, input.habitsScheduled),
    },
    {
      key: "exercise",
      label: "运动",
      ratio: completionRatio(input.exerciseMinutes, targetMinutes),
    },
    {
      key: "water",
      label: "饮水",
      ratio: completionRatio(input.waterMl, input.waterTargetMl),
    },
    {
      key: "diet",
      label: "饮食",
      ratio: completionRatio(input.kcal, input.kcalTargetKcal),
    },
  ];

  const known = metrics.filter((metric): metric is GrowthMetric & { ratio: number } => metric.ratio !== null);
  const ratio =
    known.length > 0 ? known.reduce((sum, metric) => sum + metric.ratio, 0) / known.length : null;

  return {
    metrics,
    ratio,
    percent: ratio === null ? null : Math.round(ratio * 100),
    achieved: known.filter((metric) => metric.ratio >= 1).length,
  };
}

export interface GrowthWeekDay {
  /** 本地日期键（YYYY-MM-DD） */
  key: string;
  /** 单字星期（一…日） */
  label: string;
  /** 当天有没有记录（饮水或饮食任一；接口失败的那路不参与） */
  recorded: boolean;
  isToday: boolean;
}

export interface GrowthWeekLogInput {
  todayKey: string;
  /** 近 7 天逐日饮水（由旧到新，最后一项 = 今天）；null = 那天没取到 */
  waterByDay: readonly (number | null)[];
  /** /api/nutrition/summary?days=7 的逐日行 */
  kcalRows: readonly { date: string; entryCount: number }[];
  /** 饮食接口是否成功；false 时不能把「没记录」当成「0 记录」的独立证据 */
  kcalAvailable: boolean;
}

/** 近 7 天的「有没有记录」状态（供概览层的 7 格周状态条） */
export function buildWeekLogDays(input: GrowthWeekLogInput): GrowthWeekDay[] {
  const keys = lastSevenKeys(input.todayKey);
  const dietByDate = new Map<string, number>();
  if (input.kcalAvailable && Array.isArray(input.kcalRows)) {
    for (const row of input.kcalRows) {
      if (!row || typeof row.date !== "string") continue;
      const entries = Number(row.entryCount);
      if (Number.isFinite(entries) && entries > 0) dietByDate.set(row.date.slice(0, 10), entries);
    }
  }

  return keys.map((key, index) => {
    const water = input.waterByDay[index];
    const waterLogged = typeof water === "number" && Number.isFinite(water) && water > 0;
    const dietLogged = dietByDate.has(key);
    return {
      key,
      label: weekdayShort(key),
      recorded: waterLogged || dietLogged,
      isToday: key === input.todayKey,
    };
  });
}

/** 周状态里有记录的天数 */
export function countRecordedDays(days: readonly GrowthWeekDay[]): number {
  return days.reduce((count, day) => (day.recorded ? count + 1 : count), 0);
}
