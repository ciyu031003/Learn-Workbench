/**
 * 连续天数（streak）口径（S5-1）：双端唯一实现。
 *
 * 口径沿自 Web 现有实现（apps/web/app/api/dashboard/route.ts、summary/route.ts、
 * focus/daily/route.ts 三处重复代码）：
 *  1. 每个事件先落到业务时区（默认 Asia/Shanghai）的日历日，同日多条自动去重；
 *  2. 从「今天」往前数；**今天还没有事件不算断档**，从昨天起数；
 *  3. 中间缺任意一天即中断。
 *
 * 纯函数、无 I/O。
 */
import { DEFAULT_TIME_ZONE, addDaysToDateKey, dateKeyInZone, isDateKey } from "./date";

export interface ComputeStreakOptions {
  /** 业务时区，默认 Asia/Shanghai（决策 D3） */
  tz?: string;
  /** 可注入的当前时间（测试用；默认 new Date()） */
  now?: Date | string | number;
}

/** 可接受的「事件时间」：Date / ISO 字符串 / 毫秒时间戳 / 日期键 */
export type StreakEvent = Date | string | number;

/** 事件 → 业务时区日期键；非法输入返回 null（调用方忽略） */
export function streakEventDateKey(event: unknown, tz: string = DEFAULT_TIME_ZONE): string | null {
  if (event == null) return null;
  if (typeof event === "string" && isDateKey(event)) return event.trim();
  if (typeof event !== "string" && typeof event !== "number" && !(event instanceof Date)) return null;
  try {
    return dateKeyInZone(event as Date | string | number, tz);
  } catch {
    return null;
  }
}

/**
 * 计算连续天数。
 *
 * @example
 * computeStreak(["2026-10-17", "2026-10-18"], { now: "2026-10-19T02:00:00+08:00" }) // 2
 * computeStreak([new Date("2026-10-18T17:00:00Z")], { tz: "Asia/Shanghai" })        // 10-19 → 1
 */
export function computeStreak(
  events: ReadonlyArray<StreakEvent | null | undefined>,
  options: ComputeStreakOptions = {}
): number {
  const tz = options.tz || DEFAULT_TIME_ZONE;
  const now = options.now ?? new Date();
  const days = new Set<string>();
  for (const event of events ?? []) {
    const key = streakEventDateKey(event, tz);
    if (key) days.add(key);
  }
  if (days.size === 0) return 0;

  let cursor = dateKeyInZone(now, tz);
  if (!days.has(cursor)) cursor = addDaysToDateKey(cursor, -1);

  let streak = 0;
  // 上限 = 事件天数，避免脏数据造成死循环
  while (days.has(cursor) && streak < days.size) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }
  return streak;
}
