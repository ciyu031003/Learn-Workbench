/**
 * 同步账本 · 纯聚合核心（零 react-native / 零 AsyncStorage 依赖，可单测）。
 *
 * 5 条离线通道（业务变更 / 饮食 / 图片 / 答题 / 408 刷卡）各自独立补发，
 * 用户只需要一个数字回答"我记的东西都同步上去了吗"。这里只做聚合，不产生真相。
 */
export type SyncChannel = "business" | "nutrition" | "upload" | "learning" | "exam408";

export interface SyncLedgerInput {
  businessCount: number;
  businessOldestAt: string | null;
  nutrition: number;
  upload: number;
  /** 学习答题 + 错题动作两条本地队列的合计 */
  learning: number;
  exam408: number;
}

export interface SyncLedger {
  total: number;
  byChannel: Record<SyncChannel, number>;
  /** 全部待发里最老的一条（ISO）；未知为 null */
  oldestPendingAt: string | null;
  /** false = 有通道读取失败，UI 不能把 0 当成"已同步" */
  loaded: boolean;
}

export const EMPTY_SYNC_LEDGER: SyncLedger = {
  total: 0,
  byChannel: { business: 0, nutrition: 0, upload: 0, learning: 0, exam408: 0 },
  oldestPendingAt: null,
  loaded: false,
};

const CHANNEL_LABELS: Record<SyncChannel, string> = {
  business: "记录",
  nutrition: "饮食",
  upload: "图片",
  learning: "答题",
  exam408: "刷卡",
};

function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const n = Math.trunc(value);
  return n > 0 ? n : 0;
}

export function summarizeLedger(input: SyncLedgerInput): SyncLedger {
  const byChannel: Record<SyncChannel, number> = {
    business: safeCount(input.businessCount),
    nutrition: safeCount(input.nutrition),
    upload: safeCount(input.upload),
    learning: safeCount(input.learning),
    exam408: safeCount(input.exam408),
  };
  const total = Object.values(byChannel).reduce((sum, n) => sum + n, 0);
  return {
    total,
    byChannel,
    oldestPendingAt: byChannel.business > 0 ? input.businessOldestAt : null,
    loaded: true,
  };
}

/** 解析 op 队列（{ ops: [] } 或裸数组）；解析失败返回 null（不可谎报 0） */
export function countOps(raw: string | null): number | null {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") {
      const ops = (parsed as { ops?: unknown }).ops;
      if (Array.isArray(ops)) return ops.length;
    }
    return 0;
  } catch {
    return null;
  }
}

/** 解析裸数组队列；解析失败返回 null */
export function countArray(raw: string | null): number | null {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return null;
  }
}

/** 一句话描述（不含 0 值通道）；null 表示还没读到 */
export function describeLedger(ledger: SyncLedger | null): string {
  if (!ledger) return "正在读取待同步队列…";
  if (ledger.total === 0) return ledger.loaded ? "全部已同步" : "待同步队列读取失败";
  const parts: string[] = [];
  for (const key of Object.keys(ledger.byChannel) as SyncChannel[]) {
    const n = ledger.byChannel[key];
    if (n > 0) parts.push(CHANNEL_LABELS[key] + " " + n);
  }
  return "待同步 " + ledger.total + " 条（" + parts.join(" · ") + "）";
}
