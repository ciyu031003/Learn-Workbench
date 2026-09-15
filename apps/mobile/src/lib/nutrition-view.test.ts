import { describe, it, expect } from "vitest";
import {
  formatEntryTime,
  kcalEquivalentText,
  macroStatus,
  nutritionTargetRange,
  recentDateKeys,
  remainingKcal,
  withinRange,
  MEAL_KCAL_SHARES,
} from "@learn-workbench/shared";
import { foodEmoji, FOOD_EMOJI_FALLBACK } from "./food-emoji";

/**
 * v3 饮食模块的纯函数契约（M1 剩余热量 / M3 时间线 / M5 区间目标 / M4 贴纸）。
 * 这些函数同时被 Web 与 Mobile 使用，改动必须先过这里。
 */
describe("remainingKcal（M1：以剩余为主角）", () => {
  it("正常情况返回差值", () => {
    expect(remainingKcal(1380, 2000)).toBe(620);
  });
  it("超出目标返回负数（UI 用红色 + 文案，不做阻断）", () => {
    expect(remainingKcal(2120, 2000)).toBe(-120);
  });
  it("目标非法时按 0 处理，不产生 NaN", () => {
    expect(remainingKcal(500, 0)).toBe(-500);
    expect(remainingKcal(Number.NaN, 2000)).toBe(2000);
  });
});

describe("nutritionTargetRange（D3：区间目标）", () => {
  it("默认 ±12%", () => {
    expect(nutritionTargetRange(100)).toEqual({ min: 88, max: 112 });
  });
  it("细小目标至少有 1 的宽度", () => {
    const r = nutritionTargetRange(5);
    expect(r.max - r.min).toBeGreaterThanOrEqual(2);
  });
  it("0 / 非法值安全", () => {
    expect(nutritionTargetRange(0)).toEqual({ min: 0, max: 1 });
    expect(nutritionTargetRange(Number.NaN)).toEqual({ min: 0, max: 1 });
  });
});

describe("macroStatus / withinRange（M5：达标绿）", () => {
  const r = { min: 90, max: 110 };
  it("区间内为 in（含边界）", () => {
    expect(macroStatus(90, r)).toBe("in");
    expect(macroStatus(110, r)).toBe("in");
    expect(withinRange(100, r)).toBe(true);
  });
  it("低于下沿 under、高于上沿 over", () => {
    expect(macroStatus(68, r)).toBe("under");
    expect(macroStatus(118, r)).toBe("over");
  });
});

describe("kcalEquivalentText（换算文案只用一条）", () => {
  it("大额热量给出主食/饮品类对照", () => {
    expect(kcalEquivalentText(620)).toMatch(/^约等于 /);
  });
  it("小额热量给轻量文案", () => {
    expect(kcalEquivalentText(40)).toBe("很轻的一份加餐");
  });
  it("负数按绝对值（超出场景也能用）", () => {
    expect(kcalEquivalentText(-620)).toBe(kcalEquivalentText(620));
  });
});

describe("formatEntryTime（M3：时间线显示 HH:mm）", () => {
  it("解析 ISO 并补零", () => {
    const iso = new Date(2026, 8, 15, 8, 5, 0).toISOString();
    expect(formatEntryTime(iso)).toBe("08:05");
  });
  it("空值与非法值返回 null（不显示假时间）", () => {
    expect(formatEntryTime(null)).toBeNull();
    expect(formatEntryTime(undefined)).toBeNull();
    expect(formatEntryTime("垃圾数据")).toBeNull();
  });
});

describe("recentDateKeys（M2：日期条与多日汇总共用）", () => {
  it("升序、含今天、长度正确", () => {
    const today = new Date(2026, 8, 15);
    const keys = recentDateKeys(7, today);
    expect(keys).toHaveLength(7);
    expect(keys[6]).toBe("2026-09-15");
    expect(keys[0]).toBe("2026-09-09");
  });
  it("跨月正确（9/1 往前 3 天进入 8 月）", () => {
    expect(recentDateKeys(3, new Date(2026, 8, 1))).toEqual(["2026-08-30", "2026-08-31", "2026-09-01"]);
  });
});

describe("MEAL_KCAL_SHARES（M3：餐次目标占比）", () => {
  it("四餐占比合计为 1", () => {
    const sum = Object.values(MEAL_KCAL_SHARES).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100)).toBe(100);
  });
});

describe("foodEmoji（M4：emoji 贴纸兜底）", () => {
  it("命中具体关键词", () => {
    expect(foodEmoji("水煮蛋")).toBe("🥚");
    expect(foodEmoji("香煎鳕鱼海鲜烩菜")).toBe("🐟");
    expect(foodEmoji("炸鸡")).toBe("🍗");
  });
  it("更长的关键词优先（避免被泛词抢走）", () => {
    // 三文鱼(3) 必须先于 鱼(1) 命中
    expect(foodEmoji("三文鱼刺身")).toBe("🍣");
  });
  it("同长度时按表序（主食/蛋白类在前，故优先于蔬果/乳饮）", () => {
    expect(foodEmoji("燕麦牛奶")).toBe("🥣");
    expect(foodEmoji("鸡胸肉沙拉")).toBe("🍗");
  });
  it("未知食物用兜底，不抛错", () => {
    expect(foodEmoji("某某神秘料理")).toBe(FOOD_EMOJI_FALLBACK);
    expect(foodEmoji("")).toBe(FOOD_EMOJI_FALLBACK);
    expect(foodEmoji(null)).toBe(FOOD_EMOJI_FALLBACK);
  });
});
