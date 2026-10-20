import { useSyncExternalStore } from "react";

/**
 * 服务端时钟偏移（S5-3 第 5 项）。
 *
 * 客户端**不再信任本机时钟**推进同步游标（游标只认服务端返回的 serverTime），
 * 但设备时间严重跑偏仍会造成两个可感知问题：
 *   1. 本地写入的 updatedAt 超前/滞后 → 服务端 LWW 可能误判（服务端已把未来时间钳到 +5min）；
 *   2. 用户看到「上次同步」时间不对、排查困难。
 * 所以每次 push/pull 拿到 serverTime 时记一次偏移；|偏移| > 5min 时在「我的 → 数据同步」提示校准。
 */
export const CLOCK_SKEW_WARN_MS = 5 * 60_000;

interface ClockSample {
  /** serverTime - deviceTime（ms）：正数=手机时间比服务器慢 */
  offsetMs: number;
  sampledAt: number;
}

let sample: ClockSample | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  snapshotCache = null; // 样本变了：失效缓存，下次 getSnapshot 生成新对象（引用只在此刻变化）
  listeners.forEach((l) => l());
}

function parseServerTime(serverTime: string | number | Date): number | null {
  if (serverTime instanceof Date) {
    const t = serverTime.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof serverTime === "number") return Number.isFinite(serverTime) ? serverTime : null;
  const t = new Date(serverTime).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * 记录一次服务端时间样本（push/pull 响应里的 serverTime）。
 * @returns 最新偏移（ms）；serverTime 非法时返回上一次的值（无样本为 0）
 */
export function noteServerTime(serverTime: string | number | Date, deviceNow: number = Date.now()): number {
  const server = parseServerTime(serverTime);
  if (server === null) return getServerClockOffsetMs();
  sample = { offsetMs: server - deviceNow, sampledAt: deviceNow };
  emit();
  return sample.offsetMs;
}

export function getServerClockOffsetMs(): number {
  return sample?.offsetMs ?? 0;
}

export function getServerClockSample(): ClockSample | null {
  return sample;
}

export function hasServerClockSample(): boolean {
  return sample !== null;
}

/** |偏移| > 5min 视为需要校准（严格大于，正好 5min 不提示） */
export function isClockSkewed(thresholdMs: number = CLOCK_SKEW_WARN_MS): boolean {
  return sample !== null && Math.abs(sample.offsetMs) > thresholdMs;
}

/** 面向 UI 的说明：手机比服务器快/慢多少分钟 */
export function clockSkewHint(offsetMs: number): string {
  const minutes = Math.round(Math.abs(offsetMs) / 60_000);
  const direction = offsetMs > 0 ? "慢" : "快";
  return `手机时间比服务器${direction}约 ${minutes} 分钟`;
}

export function subscribeServerClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type ServerClockSnapshot = { offsetMs: number; sampled: boolean; skewed: boolean };
const EMPTY_SNAPSHOT: ServerClockSnapshot = { offsetMs: 0, sampled: false, skewed: false };
/**
 * 快照必须**引用稳定**：useSyncExternalStore 要求 getSnapshot 在数据未变时返回同一个对象，
 * 否则 React 会判定"快照每次都变"→ 无限重渲染（生产表现为打开设置页直接闪退）。
 * 这里按「样本变化才重建」缓存，emit() 时失效。
 */
let snapshotCache: ServerClockSnapshot | null = null;
export function getServerClockSnapshot(): ServerClockSnapshot {
  if (!sample) return EMPTY_SNAPSHOT;
  if (!snapshotCache) {
    snapshotCache = { offsetMs: sample.offsetMs, sampled: true, skewed: isClockSkewed() };
  }
  return snapshotCache;
}
function subscribeServerClockStore(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 订阅服务端时钟样本（设置页时钟提示用） */
export function useServerClock(): ServerClockSnapshot {
  return useSyncExternalStore(subscribeServerClockStore, getServerClockSnapshot);
}

/** 测试用：清空样本 */
export function __resetServerClockForTests(): void {
  sample = null;
  snapshotCache = null;
  listeners.clear();
}
