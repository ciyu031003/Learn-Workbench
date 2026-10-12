import { describe, expect, it } from "vitest";
import { fromDateKey, type ExerciseType } from "@learn-workbench/shared";
import {
  buildSportTrend,
  formatSportDuration,
  sportLogDateKey,
  type SportLogLike,
} from "./sport-trend";

/** 某天当地 12:00 的 ISO 时间戳（用当地时间构造，避免测试受运行机器时区影响） */
function isoAt(key: string, hour = 12): string {
  const d = fromDateKey(key);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function log(key: string, minutes: number, type: ExerciseType = "AEROBIC", sportKey = "run"): SportLogLike {
  return { sportKey, name: sportKey, type, minutes, createdAt: isoAt(key) };
}

describe("sportLogDateKey · 本地日归组", () => {
  it("ISO 时间戳按本地日归组（晚上 23:30 仍算当天）", () => {
    expect(sportLogDateKey(log("2026-09-16", 30))).toBe("2026-09-16");
    expect(sportLogDateKey({ ...log("2026-09-16", 30), createdAt: isoAt("2026-09-16", 23) })).toBe("2026-09-16");
  });

  it("非法时间戳返回 null，不抛错", () => {
    expect(sportLogDateKey({ ...log("2026-09-16", 30), createdAt: "not-a-date" })).toBeNull();
    expect(sportLogDateKey({ ...log("2026-09-16", 30), createdAt: "" })).toBeNull();
  });
});

describe("buildSportTrend · 近 N 天运动时长", () => {
  it("返回 N 个点（从早到晚），最后一个点是 endKey", () => {
    const s = buildSportTrend([], "2026-09-16", 7);
    expect(s.points).toHaveLength(7);
    expect(s.points[0].key).toBe("2026-09-10");
    expect(s.points[6].key).toBe("2026-09-16");
    expect(s.totalMinutes).toBe(0);
    expect(s.totalSessions).toBe(0);
    expect(s.activeDays).toBe(0);
  });

  it("按天累加分钟与次数，并给出合计/活跃天数/峰值", () => {
    const logs = [
      log("2026-09-14", 30, "AEROBIC", "run"),
      log("2026-09-14", 45, "AEROBIC", "walk"),
      log("2026-09-16", 20, "STRENGTH", "dumbbells"),
    ];
    const s = buildSportTrend(logs, "2026-09-16", 7);
    const day14 = s.points.find((p) => p.key === "2026-09-14")!;
    expect(day14.minutes).toBe(75);
    expect(day14.sessions).toBe(2);
    expect(s.totalMinutes).toBe(95);
    expect(s.totalSessions).toBe(3);
    expect(s.activeDays).toBe(2);
    expect(s.peakKey).toBe("2026-09-14");
    expect(s.peakMinutes).toBe(75);
  });

  it("窗口外的记录被忽略（含上/下边界）", () => {
    const logs = [log("2026-09-09", 99), log("2026-09-10", 10), log("2026-09-16", 10), log("2026-09-17", 99)];
    const s = buildSportTrend(logs, "2026-09-16", 7);
    expect(s.totalMinutes).toBe(20);
    expect(s.totalSessions).toBe(2);
  });

  it("按类型筛选只影响每日序列；byType 仍统计窗口内全部类型（否则切不回去）", () => {
    const logs = [log("2026-09-16", 30, "AEROBIC"), log("2026-09-15", 50, "STRENGTH"), log("2026-09-14", 10, "STRENGTH")];
    const all = buildSportTrend(logs, "2026-09-16", 7);
    expect(all.byType.map((t) => t.type)).toEqual(["STRENGTH", "AEROBIC"]);
    expect(all.byType[0]).toMatchObject({ type: "STRENGTH", minutes: 60, sessions: 2 });

    const strength = buildSportTrend(logs, "2026-09-16", 7, "STRENGTH");
    expect(strength.totalMinutes).toBe(60);
    expect(strength.totalSessions).toBe(2);
    expect(strength.points.find((p) => p.key === "2026-09-16")!.minutes).toBe(0);
    // 关键不变量：筛选后 byType 仍是全部类型
    expect(strength.byType).toHaveLength(2);
  });

  it("30 天窗口用 M/D 标签，且窗口起点正确", () => {
    const s = buildSportTrend([], "2026-09-16", 30);
    expect(s.points).toHaveLength(30);
    expect(s.points[0].key).toBe("2026-08-18");
    expect(s.points[0].label).toBe("8/18");
    expect(s.points[29].label).toBe("9/16");
  });

  it("7 天窗口的横轴标签是星期（与饮食趋势同一套）", () => {
    // 2026-09-16 是周三
    const s = buildSportTrend([], "2026-09-16", 7);
    expect(s.points[6].label).toBe("三");
    expect(s.points[0].label).toBe("四");
  });

  it("非法日期的记录被跳过", () => {
    const logs = [log("2026-09-16", 30), { ...log("2026-09-16", 30), createdAt: "x" }];
    const s = buildSportTrend(logs, "2026-09-16", 7);
    expect(s.totalSessions).toBe(1);
    expect(s.totalMinutes).toBe(30);
  });
});

describe("formatSportDuration", () => {
  it("分钟/小时分别展示，不出现『1 小时 0 分』", () => {
    expect(formatSportDuration(0)).toBe("0 分钟");
    expect(formatSportDuration(45)).toBe("45 分钟");
    expect(formatSportDuration(60)).toBe("1 小时");
    expect(formatSportDuration(90)).toBe("1 小时 30 分");
    expect(formatSportDuration(125)).toBe("2 小时 5 分");
  });
});
