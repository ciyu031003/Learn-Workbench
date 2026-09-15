/**
 * 身体指标纯函数（v3 M8）：BMI、均线去噪、增减量。
 * 借 MacroFactor 的做法：**原始点 + 7 日均线**，弱化单日波动带来的焦虑。
 */
export interface WeightPoint {
  date: string;
  weightKg: number;
}

/** BMI = kg / m²（身高缺失/非法 → null） */
export function computeBmi(weightKg: number, heightCm: number | null | undefined): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!heightCm || !Number.isFinite(heightCm) || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** BMI 分档（中性措辞，不做肥胖警示） */
export function bmiLabel(bmi: number | null): string | null {
  if (bmi === null || !Number.isFinite(bmi)) return null;
  if (bmi < 18.5) return "偏轻";
  if (bmi < 24) return "正常";
  if (bmi < 28) return "偏高";
  return "偏高较多";
}

/**
 * 移动平均（等权，窗口不足时用可得点）。
 * 与原始序列等长（前几项用已有点均值），便于与原始点同图对比。
 */
export function movingAverage(points: number[], window = 7): number[] {
  if (!Array.isArray(points) || points.length === 0) return [];
  const w = Math.max(1, Math.round(window));
  return points.map((_, i) => {
    const from = Math.max(0, i - w + 1);
    const slice = points.slice(from, i + 1).filter((n) => Number.isFinite(n));
    if (slice.length === 0) return 0;
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    return Math.round(avg * 100) / 100;
  });
}

/** 与首条相比的增减（kg，保留 1 位；不足 2 条 → null） */
export function weightDelta(points: WeightPoint[]): number | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  const first = points[0]?.weightKg;
  const last = points[points.length - 1]?.weightKg;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  return Math.round((last - first) * 10) / 10;
}

/** 增减文案（不带评判，如 `较首日 -0.8 kg`） */
export function weightDeltaText(delta: number | null): string | null {
  if (delta === null) return null;
  if (Math.abs(delta) < 0.05) return "与首日持平";
  return `较首日 ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`;
}
