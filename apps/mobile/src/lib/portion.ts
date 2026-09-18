/**
 * 份量换算（v3 M4）——纯函数，独立于组件以便单测（组件文件不可被 vitest 导入：
 * 会连带 react-native 一起加载，见看板踩坑点 48）。
 */

/** 吸附到 step 并钳位到 [min, max]，消除浮点误差 */
export function snapPortion(value: number, min = 0.5, max = 3, step = 0.5): number {
  // 允许在 UI 线程 worklet 里调用（v1.4.2 真机崩溃：普通函数在 worklet 里同步调用会崩）
  "worklet";
  const v = Number.isFinite(value) ? value : min;
  const s = step > 0 ? step : 0.5;
  const n = Math.round((v - min) / s) * s + min;
  const clamped = Math.min(max, Math.max(min, n));
  return Math.round(clamped * 100) / 100;
}

/** 份量 → 百分比（滑杆中心读数用） */
export function portionPercent(value: number, min = 0.5, max = 3): number {
  const span = Math.max(0.01, max - min);
  const v = Number.isFinite(value) ? value : min;
  return Math.round(((v - min) / span) * 100);
}

/** 按份量换算营养（用于「实时预览」文案；服务端也会独立重算一次） */
export function scaleNutrition(
  base: { kcal: number; proteinG: number; carbsG: number; fatG: number },
  amount: number
): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
  const a = Number.isFinite(amount) && amount > 0 ? amount : 1;
  const r = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * a * 10) / 10;
  return { kcal: r(base.kcal), proteinG: r(base.proteinG), carbsG: r(base.carbsG), fatG: r(base.fatG) };
}

/** 实时预览文案（如 `≈ 156 kcal · P12.6 C0.6 F5.3`） */
export function portionPreviewText(
  base: { kcal: number; proteinG: number; carbsG: number; fatG: number },
  amount: number
): string {
  const s = scaleNutrition(base, amount);
  return `≈ ${Math.round(s.kcal)} kcal · P${s.proteinG} C${s.carbsG} F${s.fatG}`;
}
