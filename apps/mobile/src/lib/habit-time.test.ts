import { describe, it, expect } from "vitest";
import { habitTimeLabel, normalizeHabitTime } from "@learn-workbench/shared";

/**
 * 迁移 043 / Bug 7c：习惯时间段（HH:MM）。
 * 契约：非法或空 → null（不阻塞保存），展示文案只在两端都合法时给出。
 */
describe("normalizeHabitTime", () => {
  it("接受 24 小时制 HH:MM", () => {
    expect(normalizeHabitTime("07:00")).toBe("07:00");
    expect(normalizeHabitTime("23:59")).toBe("23:59");
    expect(normalizeHabitTime("00:00")).toBe("00:00");
    expect(normalizeHabitTime(" 08:30 ")).toBe("08:30");
  });

  it("拒绝越界与残缺格式", () => {
    expect(normalizeHabitTime("24:00")).toBeNull();
    expect(normalizeHabitTime("07:60")).toBeNull();
    expect(normalizeHabitTime("7:00")).toBeNull();
    expect(normalizeHabitTime("")).toBeNull();
    expect(normalizeHabitTime("早上七点")).toBeNull();
  });

  it("非字符串一律 null（不抛错）", () => {
    expect(normalizeHabitTime(undefined)).toBeNull();
    expect(normalizeHabitTime(null)).toBeNull();
    expect(normalizeHabitTime(700)).toBeNull();
  });
});

describe("habitTimeLabel", () => {
  it("两端合法才给出区间文案", () => {
    expect(habitTimeLabel({ remindStart: "07:00", remindEnd: "08:00" })).toBe("07:00–08:00");
  });

  it("缺一端或非法 → null（不展示半个区间）", () => {
    expect(habitTimeLabel({ remindStart: "07:00", remindEnd: null })).toBeNull();
    expect(habitTimeLabel({ remindStart: null, remindEnd: "08:00" })).toBeNull();
    expect(habitTimeLabel({ remindStart: "xx", remindEnd: "08:00" })).toBeNull();
    expect(habitTimeLabel({})).toBeNull();
  });
});
