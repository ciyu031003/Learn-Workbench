import { describe, it, expect } from "vitest";
import {
  EXERCISE_TARGET_MIN,
  NO_RECORD,
  clockText,
  lastSevenKeys,
  monthDayLabel,
  round1,
  weekTile,
  weekdayShort,
} from "./growth-format";

/**
 * 成长页 / 数据看板共用的展示辅助（重构时从页内函数抽到 components/growth）：
 * 日期键窗口与旧版成长页逐字一致（后端 /api/nutrition/summary?days=7 也是以今天为终点），
 * 缺数据统一「—」，脏时间戳不抛异常。
 */
describe("lastSevenKeys", () => {
  it("以 todayKey 为终点、7 个连续本地日期键", () => {
    const keys = lastSevenKeys("2026-11-22");
    expect(keys).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("跨月边界不跳日", () => {
    expect(lastSevenKeys("2026-03-02")).toEqual([
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});

describe("weekdayShort", () => {
  it("日期键 → 单字星期（周一…周日同序）", () => {
    expect(weekdayShort("2026-11-16")).toBe("一");
    expect(weekdayShort("2026-11-22")).toBe("日");
  });
});

describe("round1", () => {
  it("保留一位小数（体重的本周变化要能出现负值）", () => {
    expect(round1(72.34)).toBe(72.3);
    expect(round1(-1.25)).toBe(-1.2);
    expect(round1(0)).toBe(0);
  });
});

describe("clockText", () => {
  it("本地时刻按 HH:mm 输出", () => {
    expect(clockText("2026-11-22T09:05:00")).toBe("09:05");
  });

  it("缺省 / 脏数据返回 null（不抛异常）", () => {
    expect(clockText(undefined)).toBeNull();
    expect(clockText("not-a-date")).toBeNull();
    expect(clockText("")).toBeNull();
  });
});

describe("monthDayLabel", () => {
  it("日期键 → 「11 月 22 日」", () => {
    expect(monthDayLabel("2026-11-22")).toBe("11 月 22 日");
  });
});

describe("weekTile", () => {
  it("lib 的展示串原样搬进 StatTile，图标/色调由页面决定", () => {
    const tile = weekTile(
      { label: "训练次数", value: "3", unit: "次", hint: "近 7 天" },
      "barbell-outline",
      "primary"
    );
    expect(tile).toMatchObject({
      label: "训练次数",
      value: "3",
      unit: "次",
      hint: "近 7 天",
      icon: "barbell-outline",
      tone: "primary",
    });
  });
});

describe("常量", () => {
  it("运动目标与无记录占位与旧版一致", () => {
    expect(EXERCISE_TARGET_MIN).toBe(30);
    expect(NO_RECORD).toBe("—");
  });
});
