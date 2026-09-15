import { describe, it, expect } from "vitest";
import { portionPercent, portionPreviewText, scaleNutrition, snapPortion } from "./portion";

/**
 * v3 M4 份量换算契约：滑杆吸附、实时预览、按份量缩放营养。
 * 服务端 PATCH 会独立重算一次（食物型条目），这里保证客户端预览与之一致。
 */
describe("snapPortion", () => {
  it("吸附到最近的 step", () => {
    expect(snapPortion(1.24)).toBe(1);
    expect(snapPortion(1.26)).toBe(1.5);
    expect(snapPortion(2.0)).toBe(2);
  });
  it("钳位到 [min, max]", () => {
    expect(snapPortion(0.1)).toBe(0.5);
    expect(snapPortion(99)).toBe(3);
  });
  it("消除浮点误差", () => {
    expect(snapPortion(1.5)).toBe(1.5);
    expect(String(snapPortion(0.5 + 0.5 * 2))).toBe("1.5");
  });
  it("非法输入回落到 min", () => {
    expect(snapPortion(Number.NaN)).toBe(0.5);
  });
  it("支持自定义步长（克重场景 50g 步进）", () => {
    expect(snapPortion(120, 50, 500, 10)).toBe(120);
    expect(snapPortion(123, 50, 500, 10)).toBe(120);
  });
});

describe("portionPercent", () => {
  it("区间端点与中点", () => {
    expect(portionPercent(0.5)).toBe(0);
    expect(portionPercent(3)).toBe(100);
    expect(portionPercent(1.75)).toBe(50);
  });
});

describe("scaleNutrition / portionPreviewText", () => {
  const egg = { kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3 };
  it("按份量等比缩放并保留 1 位小数", () => {
    expect(scaleNutrition(egg, 2)).toEqual({ kcal: 156, proteinG: 12.6, carbsG: 1.2, fatG: 10.6 });
  });
  it("非法份量按 1 份处理", () => {
    expect(scaleNutrition(egg, 0).kcal).toBe(78);
    expect(scaleNutrition(egg, Number.NaN).kcal).toBe(78);
  });
  it("预览文案包含四项（与 PATCH 后的服务端口径一致）", () => {
    expect(portionPreviewText(egg, 2)).toBe("≈ 156 kcal · P12.6 C1.2 F10.6");
  });
});
