import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";

/** 日期键加减（本地时区；跨月/跨年由 Date 处理） */
export function addDaysKey(key: string, delta: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/** 含 endKey 在内的最近 n 天（升序） */
export function lastNDays(endKey: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDaysKey(endKey, -i));
  return out;
}

export function weekdayShort(key: string): string {
  const d = fromDateKey(key);
  return "日一二三四五六"[d.getDay()] ?? "";
}

export function monthDayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return Number(m) + "月" + Number(d) + "日";
}
