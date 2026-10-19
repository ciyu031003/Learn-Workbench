/**
 * 日期口径（S5-1）：双端唯一的「业务日期」实现。
 *
 * 背景：Web 服务器跑在 UTC，中国用户在东八区；移动端有设备时区。历史上各端自己用
 * `new Date().toISOString().slice(0,10)` / 本地 getFullYear() 拼日期，导致：
 *  - 东八区 00:00–08:00 期间「今天」被算成前一天（UTC 日期）；
 *  - 网页端「跨零点」后仍显示昨天的任务/打卡；
 *  - 双端对同一条记录给出不同日期。
 *
 * 约定（决策 D3）：业务日期统一 **Asia/Shanghai（东八区）**，用 Intl.DateTimeFormat
 * 计算（不引第三方时区库；中国无夏令时，偏移恒为 +08:00）。
 *
 * 纯函数、无 I/O、可被客户端 bundle 引用（shared/domains 不含 zod）。
 */

/** 默认业务时区（决策 D3：东八区） */
export const DEFAULT_TIME_ZONE = "Asia/Shanghai";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** formatter 缓存：按 tz 复用，避免热路径每条记录都 new Intl.DateTimeFormat */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(tz);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterCache.set(tz, formatter);
  return formatter;
}

/** 是否为 YYYY-MM-DD 日期键（只做形态判断，不校验真实日期） */
export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_RE.test(value.trim());
}

function coerceDate(value: Date | string | number): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 给定日期/时间戳 → 指定时区的 YYYY-MM-DD。
 *
 * - 已是日期键（YYYY-MM-DD）时原样返回：日期键本身就是「日历日」，不应再被时区平移；
 * - 其他输入（Date / ISO 字符串 / 毫秒时间戳）按 tz 落到该时区的日历日；
 * - 无法解析时抛 RangeError（调用方若面向用户输入，请先自行校验）。
 */
export function dateKeyInZone(date: Date | string | number, tz: string = DEFAULT_TIME_ZONE): string {
  if (typeof date === "string" && isDateKey(date)) return date.trim();

  const d = coerceDate(date);
  if (!d) throw new RangeError("dateKeyInZone: 无法解析日期");
  if (!tz) throw new RangeError("dateKeyInZone: 时区不能为空");

  const parts = formatterFor(tz).formatToParts(d);
  let year = "";
  let month = "";
  let day = "";
  for (const part of parts) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  if (!year || !month || !day) throw new RangeError("dateKeyInZone: 时区格式化失败");
  return `${year}-${month}-${day}`;
}

/**
 * 指定时区的「今天」。
 * @param tz 业务时区（默认 Asia/Shanghai）
 * @param now 可注入的当前时间（测试跨零点用；默认 new Date()）
 */
export function todayISOInZone(tz: string = DEFAULT_TIME_ZONE, now: Date | string | number = new Date()): string {
  return dateKeyInZone(now, tz);
}

/**
 * UTC 日历日（仅用于「Intl 时区格式化失败」的兜底，不是业务口径）。
 *
 * shared/learning.ts 的统计在非法时区时回退 UTC；把兜底收在这里，避免业务代码再写
 * toISOString().slice(0, 10)（S5-1 的归零目标）。
 */
export function dateKeyInUtc(date: Date | string | number): string {
  const d = coerceDate(date);
  if (!d) throw new RangeError("dateKeyInUtc: 无法解析日期");
  return d.toISOString().slice(0, 10);
}

/** 日期键 ±N 天（纯日历运算，与运行环境时区无关） */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const key = String(dateKey ?? "").trim();
  if (!isDateKey(key)) throw new RangeError("addDaysToDateKey: 需要 YYYY-MM-DD");
  const [year, month, day] = key.split("-").map(Number);
  const delta = Number.isFinite(days) ? Math.trunc(days) : 0;
  const shifted = new Date(Date.UTC(year, month - 1, day) + delta * 86_400_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
