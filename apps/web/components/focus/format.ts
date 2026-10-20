/** focus-timer 拆分后的共享常量/纯格式化（S8-a）。 */

export const PRESETS = [15, 25, 45];
export const RING_R = 128;
export const RING_C = 2 * Math.PI * RING_R;

/** 秒 → mm:ss */
export function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 秒数取整（非法/负数 → 0） */
export function clampSec(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}
