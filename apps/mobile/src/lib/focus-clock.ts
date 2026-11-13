/**
 * 专注全屏 / 悬浮计时共用的时钟格式化。
 * 秒数非法或为负时按 0 处理；超过 99 分钟保留分钟位（例如 125:00），
 * 与全屏计时里既有的 fmt() 口径一致。
 */
export function formatFocusClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
}
