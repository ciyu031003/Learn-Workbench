import { describe, it, expect } from "vitest";
import { elapsedSeconds } from "./focus-elapsed";

/**
 * 回归护栏：2026-09-15 真机出现「点开始计时数字不动」，
 * 根因是运行状态用了 React state 判断（interval 闭包读到旧值）。
 * 这些用例锁定「运行状态只能由 startedAtMs 决定」的契约。
 */
describe("elapsedSeconds", () => {
  it("未开始（无累计、无起点）返回 0", () => {
    expect(elapsedSeconds(0, null, 1_000_000)).toBe(0);
  });

  it("正在运行：按墙钟差值计（不看任何 state）", () => {
    // 起点 1000_000，当前 1001_400 → 1.4s → 1
    expect(elapsedSeconds(0, 1_000_000, 1_001_400)).toBe(1);
  });

  it("运行 25 秒应返回 25（旧实现会恒为 0）", () => {
    expect(elapsedSeconds(0, 1_000_000, 1_025_000)).toBe(25);
  });

  it("暂停（startedAtMs=null）只算累计，不随时间增长", () => {
    const paused = elapsedSeconds(12_000, null, 2_000_000);
    expect(paused).toBe(12);
    expect(elapsedSeconds(12_000, null, 9_999_999)).toBe(12);
  });

  it("暂停后继续：累计 + 新运行段", () => {
    // 已累计 30s，从 2_000_000 起再跑 15s
    expect(elapsedSeconds(30_000, 2_000_000, 2_015_000)).toBe(45);
  });

  it("时钟回拨/负数差值不产生负值", () => {
    expect(elapsedSeconds(5_000, 2_000_000, 1_999_000)).toBe(5);
  });

  it("非法累计值按 0 处理", () => {
    expect(elapsedSeconds(Number.NaN, 1_000_000, 1_003_000)).toBe(3);
    expect(elapsedSeconds(-5000, 1_000_000, 1_003_000)).toBe(3);
  });

  it("四舍五入到秒（0.5s 进位）", () => {
    expect(elapsedSeconds(0, 1_000_000, 1_000_499)).toBe(0);
    expect(elapsedSeconds(0, 1_000_000, 1_000_500)).toBe(1);
  });
});
