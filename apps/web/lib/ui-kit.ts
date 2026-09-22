/** v13 · Uiverse 借鉴技法的纯逻辑辅助（可单测，不依赖 DOM）。 */

/** 进度环取值：把任意数字收敛到 0–100，NaN 归零。 */
export function clampPercent(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** 提示条停留时长（ms）：错误留久一点，其余 3.2s。与 globals.css --toast-life 对应。 */
export function toastLifeMs(kind: "info" | "success" | "error" = "success"): number {
  return kind === "error" ? 4200 : 3200;
}

/** 进度环内联样式：--ring-value / --ring-size / 双色渐变。 */
export function ringStyle(options: {
  value: number;
  thickness?: number;
  from?: string;
  to?: string;
  track?: string;
}): Record<string, string> {
  const { value, thickness = 10, from, to, track } = options;
  const style: Record<string, string> = { "--ring-value": String(clampPercent(value)), "--ring-size": `${thickness}px` };
  if (from) style["--ring-from"] = from;
  if (to) style["--ring-to"] = to;
  if (track) style["--ring-track"] = track;
  return style;
}

/** 上传体积校验（≤5MB，和 apps/web/lib/resume-files.ts 口径一致，供前端提前拦截）。 */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
