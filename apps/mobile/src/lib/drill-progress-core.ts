/**
 * 408 刷卡进度：纯函数部分（可被 vitest 直接导入，不依赖 AsyncStorage）。
 * 存储实现在 lib/drill-progress.ts。
 */

/** 每日计划张数（服务端队列 limit 与 UI 文案共用） */
export const DAILY_CARD_PLAN = 20;

export interface SeenBucket {
  date: string;
  keys: string[];
}
export type SeenStore = Record<string, SeenBucket>;

/** 本地时区的 YYYY-MM-DD（不能直接用 toISOString：UTC 会把凌晨算到前一天） */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

export function bucketKeyOf(subject: string): string {
  return subject.trim() || "all";
}

/** 纯函数：过滤掉已看过的卡（保持原顺序） */
export function filterUnseen<T extends { key: string }>(cards: T[], seen: string[]): T[] {
  if (seen.length === 0) return cards;
  const set = new Set(seen);
  return cards.filter((card) => !set.has(card.key));
}

export function parseSeenStore(raw: string | null | undefined): SeenStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: SeenStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const bucket = value as { date?: unknown; keys?: unknown };
      if (typeof bucket.date !== "string" || !Array.isArray(bucket.keys)) continue;
      const keys = bucket.keys.filter((k): k is string => typeof k === "string" && k.length > 0);
      out[key] = { date: bucket.date, keys };
    }
    return out;
  } catch {
    return {};
  }
}