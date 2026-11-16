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

/* ------------------------------------------------------------------ */
/* 续播位置（v2.6.12）：不只记「看过哪些」，还记「停在哪一张」         */
/* ------------------------------------------------------------------ */

export type DrillScope = "queue" | "mistake";

/** 某科目 + 某范围（今日队列 / 易错本）的续播指针 */
export interface DrillPointer {
  date: string;
  /** 离开时正在看的那张卡（按 key 恢复比按 index 稳：服务端插卡/删卡都不会错位） */
  cardKey: string;
  /** 离开时的序号，作为 key 找不到时的兜底 */
  index: number;
}

export type DrillPointerStore = Record<string, DrillPointer>;

export function drillBucketKey(subject: string, scope: DrillScope): string {
  return scope + "|" + bucketKeyOf(subject);
}

export function parseDrillPointerStore(raw: string | null | undefined): DrillPointerStore {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: DrillPointerStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const record = value as { date?: unknown; cardKey?: unknown; index?: unknown };
      if (typeof record.date !== "string" || typeof record.cardKey !== "string") continue;
      const index = typeof record.index === "number" && Number.isFinite(record.index) ? Math.max(0, Math.floor(record.index)) : 0;
      out[key] = { date: record.date, cardKey: record.cardKey, index };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 把持久化指针换算成当前队列里的下标（v2.6.12）：
 * 1) 同一天的指针才有效；
 * 2) 指针卡还在剩余队列（cards）里 → 直接定位（服务端插卡也不会错位）；
 * 3) 指针卡已被「看过」过滤掉、或已被服务端删除：
 *    - 传了 fullOrder（本轮完整顺序）时，取 fullOrder 里它后面第一张仍在 cards 的卡；
 *      后面没有卡 → 回到剩余队列第一张（跳过没看的卡不会丢，只有全部看完才会空队列）；
 *    - 指针卡在 fullOrder 里也找不到（如易错本评级后服务端直接移除）→ 用保存的
 *      index 作为「槽位」，下一张顶到同一下标，因此返回 min(index, cards.length - 1)。
 * 4) 空队列 / 跨天 → 0。
 */
export function resolveDrillResumeIndex<T extends { key: string }>(
  cards: T[],
  pointer: DrillPointer | null | undefined,
  today: string,
  fullOrder?: T[],
): number {
  if (!pointer || pointer.date !== today || cards.length === 0) return 0;
  const byKey = cards.findIndex((card) => card.key === pointer.cardKey);
  if (byKey >= 0) return byKey;
  if (!fullOrder || fullOrder.length === 0) {
    return Math.min(Math.max(0, Math.floor(pointer.index)), cards.length - 1);
  }
  const anchor = fullOrder.findIndex((card) => card.key === pointer.cardKey);
  if (anchor >= 0) {
    const positionByKey = new Map(cards.map((card, index) => [card.key, index]));
    for (let i = anchor + 1; i < fullOrder.length; i += 1) {
      const position = positionByKey.get(fullOrder[i].key);
      if (position !== undefined) return position;
    }
    // 指针之后没有未看的卡：回到剩余队列开头，避免「从最后一张继续」把跳过的卡吞掉
    return 0;
  }
  // 卡片已被服务端移除：index 是本轮队列里的槽位，后续卡片会左移补位
  return Math.min(Math.max(0, Math.floor(pointer.index)), cards.length - 1);
}

/** 只保留当天的指针，避免 AsyncStorage 跨天无限增长 */
/**
 * 选择「整轮顺序」（v2.6.12）：优先保留更长的当天快照，服务端新插入的卡追加在后面。
 *
 * 为什么需要它：服务端当天把已评级卡从队列移除后，重新进入只拿得到「剩余 10 张」，
 * 直接用这份剩余队列做进度会显示「第 1 / 10 张」。用当天 20 张快照做顺序，
 * 当前卡就能正确显示「第 11 / 20 张」，但断网/换设备没有快照时仍以服务端队列为准。
 */
export function pickRoundOrder<T extends { key: string }>(current: T[], snapshot?: T[] | null): T[] {
  if (!snapshot || snapshot.length === 0) return current;
  if (current.length >= snapshot.length) return current;
  const known = new Set(snapshot.map((card) => card.key));
  return [...snapshot, ...current.filter((card) => !known.has(card.key))];
}

/** 当前卡在整轮顺序里的下标；找不到（服务端新卡且无快照）时退回本会话下标。 */
export function roundOrderPosition<T extends { key: string }>(
  order: T[],
  cardKey: string,
  fallbackIndex: number,
): number {
  const found = order.findIndex((card) => card.key === cardKey);
  if (found >= 0) return found;
  return Math.max(0, Math.floor(Number.isFinite(fallbackIndex) ? fallbackIndex : 0));
}

export function pruneDrillPointerStore(store: DrillPointerStore, today: string): DrillPointerStore {
  const out: DrillPointerStore = {};
  for (const [key, value] of Object.entries(store)) {
    if (value.date === today) out[key] = value;
  }
  return out;
}
