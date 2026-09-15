/**
 * 专注/运动计时的「已跑秒数」计算（墙钟口径，唯一事实源）
 *
 * 背景（2026-09-15 真机回归）：此前 `currentElapsed()` 用 `running`（React state）判断是否在跑，
 * 而 `setInterval` 注册的是「注册那一刻的闭包」，`setRunning(true)` 又是异步的 →
 * interval 回调里永远读到 `running=false` → 已跑时长恒为 0，表现为「点开始计时但数字不动」。
 *
 * 因此运行状态只能用 `startedAtMs`（ref）判断：
 *   - `startedAtMs !== null` 视为正在运行，已跑 = 累计 + (now - 起点)
 *   - `startedAtMs === null` 视为暂停/未开始，已跑 = 累计
 *
 * @param accumulatedMs 已完成段落累计毫秒（暂停时把当前段折进来）
 * @param startedAtMs   当前运行段的墙钟起点；null = 未在运行
 * @param nowMs         当前墙钟毫秒
 */
export function elapsedSeconds(
  accumulatedMs: number,
  startedAtMs: number | null,
  nowMs: number
): number {
  const acc = Number.isFinite(accumulatedMs) && accumulatedMs > 0 ? accumulatedMs : 0;
  const runningMs = startedAtMs === null ? 0 : Math.max(0, nowMs - startedAtMs);
  return Math.max(0, Math.round((acc + runningMs) / 1000));
}
