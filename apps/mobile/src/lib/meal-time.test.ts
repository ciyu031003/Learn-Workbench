import { describe, it, expect } from "vitest";
import { mealForNow } from "./meal-time";

const at = (h: number, m = 0) => new Date(2026, 8, 18, h, m, 0);

describe("mealForNow · 按时间推断餐次（v6 P1-2）", () => {
  it("10 点前是早餐", () => {
    expect(mealForNow(at(0))).toBe("breakfast");
    expect(mealForNow(at(6, 30))).toBe("breakfast");
    expect(mealForNow(at(9, 59))).toBe("breakfast");
  });

  it("10:00-14:59 是午餐", () => {
    expect(mealForNow(at(10, 0))).toBe("lunch");
    expect(mealForNow(at(12, 30))).toBe("lunch");
    expect(mealForNow(at(14, 59))).toBe("lunch");
  });

  it("15:00-20:59 是晚餐", () => {
    expect(mealForNow(at(15, 0))).toBe("dinner");
    expect(mealForNow(at(19, 45))).toBe("dinner");
    expect(mealForNow(at(20, 59))).toBe("dinner");
  });

  it("21 点后与深夜是加餐", () => {
    expect(mealForNow(at(21, 0))).toBe("snack");
    expect(mealForNow(at(23, 59))).toBe("snack");
  });
});
