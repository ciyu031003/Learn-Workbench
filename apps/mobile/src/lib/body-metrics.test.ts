import { describe, it, expect } from "vitest";
import { bmiLabel, computeBmi, movingAverage, weightDelta, weightDeltaText } from "./body-metrics";

/**
 * v3 M8 身体指标契约：BMI 分档与均线去噪。
 * 均线必须与原始序列等长（同图叠加），且窗口不足时用已有点。
 */
describe("computeBmi / bmiLabel", () => {
  it("按 kg / m² 计算并保留 1 位", () => {
    expect(computeBmi(70, 175)).toBe(22.9);
    expect(computeBmi(62.4, 170)).toBe(21.6);
  });
  it("身高缺失或非法 → null", () => {
    expect(computeBmi(70, null)).toBeNull();
    expect(computeBmi(70, 0)).toBeNull();
    expect(computeBmi(Number.NaN, 175)).toBeNull();
  });
  it("分档用中性措辞", () => {
    expect(bmiLabel(17)).toBe("偏轻");
    expect(bmiLabel(22)).toBe("正常");
    expect(bmiLabel(26)).toBe("偏高");
    expect(bmiLabel(30)).toBe("偏高较多");
    expect(bmiLabel(null)).toBeNull();
  });
});

describe("movingAverage", () => {
  it("与输入等长", () => {
    const out = movingAverage([60, 62, 64], 7);
    expect(out).toHaveLength(3);
  });
  it("窗口不足时用已有点的均值（首项 = 自身）", () => {
    expect(movingAverage([60, 62, 64], 3)).toEqual([60, 61, 62]);
  });
  it("窗口为 1 时等同原始序列", () => {
    expect(movingAverage([60, 62, 64], 1)).toEqual([60, 62, 64]);
  });
  it("空数组安全", () => {
    expect(movingAverage([], 7)).toEqual([]);
  });
  it("忽略非法值", () => {
    const out = movingAverage([60, Number.NaN, 66], 3);
    expect(Number.isFinite(out[1])).toBe(true);
  });
});

describe("weightDelta / weightDeltaText", () => {
  const pts = [
    { date: "2026-09-01", weightKg: 63.2 },
    { date: "2026-09-08", weightKg: 62.4 },
  ];
  it("首末差值保留 1 位", () => {
    expect(weightDelta(pts)).toBe(-0.8);
    expect(weightDeltaText(-0.8)).toBe("较首日 -0.8 kg");
  });
  it("不足两条 → null", () => {
    expect(weightDelta([pts[0]])).toBeNull();
    expect(weightDeltaText(null)).toBeNull();
  });
  it("零变化文案", () => {
    expect(weightDeltaText(0)).toBe("与首日持平");
  });
});
