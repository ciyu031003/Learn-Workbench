/**
 * 习惯颜色的可读性守门。
 *
 * 背景（真机反馈）：习惯卡片中间出现过「白色长方形条」。根因是老数据的 color 可能为空串或近白色，
 * 而卡片把它直接拼 alpha 用在左侧厚涂条、右上柔光、描边与 7 天条上 —— 浅色/白色就渲染成白光/白条。
 * 这里按**相对亮度**判断：不合法（空串、非 hex）或过亮（> 0.62）一律回落到主题主色。
 *
 * v1.27：从 habits.tsx 抽到 lib/ 以便单测（纯函数、零 react-native 依赖，vitest 可直接加载）。
 */
export function readableAccent(raw: string | null | undefined, fallback: string): string {
  const value = (raw ?? "").trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(value) ?? /^#([0-9a-fA-F]{3})$/.exec(value);
  if (!m) return fallback;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.62 ? fallback : value;
}
