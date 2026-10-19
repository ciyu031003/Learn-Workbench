/**
 * 启动水位（S6-8）：hydration gate + 设备分档（纯逻辑，可单测；不 import react-native）。
 *
 * 背景：
 *  1) splash 目前"首帧就撤"，但 zustand persist 的 AsyncStorage 恢复是异步的 ——
 *     深色模式下会先按默认浅色画一帧再切深色（白闪），离线队列/主题也可能晚一拍出现。
 *  2) 低端机（内存 < 3GB）上，首屏入场 stagger 动画 + 页面转场会明显掉帧；
 *     按设备分档降级（动画直接跳过 / 转场改淡入）比"一刀切关掉所有人的动效"更合适。
 */

export type DeviceTier = "high" | "low";

/** 低端机判定阈值：可用总内存 < 3GiB（Android 低端机常见 2-3GB） */
export const LOW_END_MEMORY_THRESHOLD_BYTES = 3 * 1024 * 1024 * 1024;

/** splash 兜底撤除时间：持久化卡死（国产 ROM Keystore/AsyncStorage 慢）时不至于永远白屏 */
export const STARTUP_HARD_TIMEOUT_MS = 4000;

/** 解析环境变量里的强制档位（EXPO_PUBLIC_FORCE_DEVICE_TIER=low|high，真机灰度/调试用） */
export function normalizeDeviceTier(raw: unknown): DeviceTier | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "low" || value === "low-end" || value === "lowend") return "low";
  if (value === "high" || value === "high-end" || value === "highend") return "high";
  return null;
}

/**
 * 设备分档：强制值 > 内存阈值 > 默认 high。
 * 内存未知时按 high 处理（宁可多播一点动画，也不要把好设备误降级）。
 */
export function classifyDeviceTier(input: {
  totalMemoryBytes?: number | null;
  forcedTier?: unknown;
}): DeviceTier {
  const forced = normalizeDeviceTier(input.forcedTier);
  if (forced) return forced;
  const memory = input.totalMemoryBytes;
  if (typeof memory === "number" && Number.isFinite(memory) && memory > 0 && memory < LOW_END_MEMORY_THRESHOLD_BYTES) {
    return "low";
  }
  return "high";
}

/* ------------------------------------------------------------ 运行时档位 */

let currentTier: DeviceTier = "high";
let tierResolved = false;

/** 由根布局在启动时写入（classifyDeviceTier 的结果）；未写入时默认 high */
export function setDeviceTier(tier: DeviceTier): void {
  currentTier = tier;
  tierResolved = true;
}

export function getDeviceTier(): DeviceTier {
  return currentTier;
}

export function isLowEndDevice(): boolean {
  return currentTier === "low";
}

/** 是否已经真正判定过（测试/诊断用） */
export function isDeviceTierResolved(): boolean {
  return tierResolved;
}

/** 测试用：复位运行时档位 */
export function __resetDeviceTierForTests(): void {
  currentTier = "high";
  tierResolved = false;
}

/* --------------------------------------------------------- hydration gate */

export type StartupGateState = "waiting" | "ready" | "timeout";
export type StartupReleaseReason = "hydrated-and-painted" | "hard-timeout";

export interface StartupGateInput {
  /** JS bundle 开始执行的时间（性能计时基准） */
  startedAt: number;
  /** 当前时间 */
  now: number;
  /** zustand persist 是否已完成恢复（hasHydrated） */
  hasHydrated: boolean;
  /** 首帧是否已渲染完成（requestAnimationFrame 回调之后） */
  firstFramePainted: boolean;
  /** 兜底时长，默认 STARTUP_HARD_TIMEOUT_MS */
  hardTimeoutMs?: number;
}

export interface StartupGateDecision {
  state: StartupGateState;
  /** 已等待毫秒数（>=0） */
  waitedMs: number;
  /** 距离兜底撤 splash 还剩多少毫秒（state=waiting 时有意义；否则 0） */
  remainingMs: number;
  /** 可以撤 splash 时的原因（state=ready/timeout） */
  reason: StartupReleaseReason | null;
}

/**
 * 启动闸门判定（纯函数）：
 *  - hasHydrated && firstFramePainted → ready（正常路径：主题/队列已恢复后再撤 splash，深色不白闪）
 *  - 超时 hardTimeoutMs → timeout（恢复卡死也不能永远白屏，按"降级放行"处理）
 *  - 其余 → waiting（调用方应在 remainingMs 后重新判定）
 */
export function evaluateStartupGate(input: StartupGateInput): StartupGateDecision {
  const hardTimeoutMs =
    typeof input.hardTimeoutMs === "number" && input.hardTimeoutMs > 0 ? input.hardTimeoutMs : STARTUP_HARD_TIMEOUT_MS;
  const waitedMs = Math.max(0, Math.round(input.now - input.startedAt));
  if (input.hasHydrated && input.firstFramePainted) {
    return { state: "ready", waitedMs, remainingMs: 0, reason: "hydrated-and-painted" };
  }
  if (waitedMs >= hardTimeoutMs) {
    return { state: "timeout", waitedMs, remainingMs: 0, reason: "hard-timeout" };
  }
  return { state: "waiting", waitedMs, remainingMs: hardTimeoutMs - waitedMs, reason: null };
}

/** 一条可读的启动摘要（崩溃面包屑 / 诊断包用） */
export function describeStartupDecision(input: {
  decision: StartupGateDecision;
  tier: DeviceTier;
  hasHydrated: boolean;
  firstFramePainted: boolean;
}): string {
  return [
    "tier=" + input.tier,
    "coldStartMs=" + input.decision.waitedMs,
    "state=" + input.decision.state,
    "hydrated=" + input.hasHydrated,
    "painted=" + input.firstFramePainted,
  ].join(" · ");
}
