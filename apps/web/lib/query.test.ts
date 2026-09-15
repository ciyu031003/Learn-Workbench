import { describe, it, expect } from "vitest";
import { readDateParam, readIntParam } from "./query";

/**
 * 回归：`Number(null) === 0` —— 参数缺失曾被当成 0 再钳位到最小值，
 * 导致 `/api/nutrition/foods`（不带 limit）只返回 1 条、`summary`（不带 days）只算 1 天。
 */
describe("readIntParam", () => {
  it("缺失 / 空串用 fallback（不是最小值）", () => {
    expect(readIntParam(null, 30, 1, 365)).toBe(30);
    expect(readIntParam(undefined, 30, 1, 365)).toBe(30);
    expect(readIntParam("", 30, 1, 365)).toBe(30);
    expect(readIntParam("   ", 30, 1, 365)).toBe(30);
  });

  it("合法数字解析并四舍五入", () => {
    expect(readIntParam("7", 30, 1, 365)).toBe(7);
    expect(readIntParam("7.6", 30, 1, 365)).toBe(8);
    expect(readIntParam("0", 30, 1, 365)).toBe(1); // 显式传 0 → 钳到最小值
  });

  it("非法值用 fallback", () => {
    expect(readIntParam("abc", 30, 1, 365)).toBe(30);
    expect(readIntParam("NaN", 30, 1, 365)).toBe(30);
  });

  it("越界钳位", () => {
    expect(readIntParam("9999", 7, 1, 31)).toBe(31);
    expect(readIntParam("-5", 7, 1, 31)).toBe(1);
  });
});

describe("readDateParam", () => {
  it("合法 YYYY-MM-DD 原样返回", () => {
    expect(readDateParam("2026-09-15")).toBe("2026-09-15");
  });
  it("非法 / 缺失 → fallback", () => {
    expect(readDateParam("nope")).toBeNull();
    expect(readDateParam(null)).toBeNull();
    expect(readDateParam("")).toBeNull();
    expect(readDateParam("2026-9-1")).toBeNull();
    expect(readDateParam("bad", "2026-01-01")).toBe("2026-01-01");
  });
});
