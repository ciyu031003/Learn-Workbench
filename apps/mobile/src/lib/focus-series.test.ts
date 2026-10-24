import { describe, expect, it } from "vitest";
import type { FocusSession } from "@learn-workbench/shared";
import {
  HEAT_LEGEND,
  PERIODS,
  addDays,
  buildDailySeries,
  buildDayMinutesMap,
  buildHeatMonthMarks,
  buildHeatmap,
  buildPeakPeriod,
  buildPeriodBars,
  buildWeekCompare,
  heatColor,
  localKey,
  sessionMinutes,
  weekdayName,
} from "./focus-series";

/** 造一条会话：只填统计真正读的两个字段 */
const at = (iso: string, minutes: number) =>
  ({ startedAt: iso, durationSeconds: minutes * 60 } as unknown as FocusSession);

describe("localKey", () => {
  it("按本地日期，不用 UTC（凌晨不会被算到前一天）", () => {
    expect(localKey(new Date(2026, 8, 29, 0, 30))).toBe("2026-09-29");
    expect(localKey(new Date(2026, 8, 29, 23, 59))).toBe("2026-09-29");
  });
});

describe("addDays / weekdayName", () => {
  it("跨月加减正确", () => {
    expect(localKey(addDays(new Date(2026, 8, 30), 1))).toBe("2026-10-01");
    expect(localKey(addDays(new Date(2026, 9, 1), -1))).toBe("2026-09-30");
  });
  it("跨年边界正确（v1.35.0 补：12/31 → 1/1 靠日期自动进位，之前没有测试钉住）", () => {
    expect(localKey(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
    expect(localKey(addDays(new Date(2027, 0, 1), -1))).toBe("2026-12-31");
  });
  it("星期名", () => {
    expect(weekdayName(new Date(2026, 8, 29))).toBe("周二");
  });
});

describe("sessionMinutes", () => {
  it("秒转分四舍五入，负数/缺失归零", () => {
    expect(sessionMinutes(at("2026-09-29T10:00:00", 25))).toBe(25);
    expect(sessionMinutes({ startedAt: "x" } as unknown as FocusSession)).toBe(0);
    expect(sessionMinutes({ startedAt: "x", durationSeconds: -30 } as unknown as FocusSession)).toBe(0);
  });
});

describe("buildDayMinutesMap", () => {
  it("按天累加，忽略坏时间戳", () => {
    const map = buildDayMinutesMap([
      at("2026-09-29T10:00:00", 30),
      at("2026-09-29T20:00:00", 15),
      at("2026-09-28T09:00:00", 60),
      { startedAt: "not-a-date", durationSeconds: 600 } as unknown as FocusSession,
    ]);
    expect(map.get("2026-09-29")).toBe(45);
    expect(map.get("2026-09-28")).toBe(60);
    expect(map.size).toBe(2);
  });
});

describe("buildPeriodBars", () => {
  it("只统计目标日期，并按本地小时落到时段", () => {
    const bars = buildPeriodBars([at("2026-09-29T07:30:00", 20), at("2026-09-29T15:00:00", 40), at("2026-09-28T15:00:00", 99)], "2026-09-29");
    expect(bars).toHaveLength(PERIODS.length);
    expect(bars.find((b) => b.label === "清晨")?.value).toBe(20);
    expect(bars.find((b) => b.label === "下午")?.value).toBe(40);
    expect(bars.reduce((s, b) => s + b.value, 0)).toBe(60);
  });
});

describe("buildDailySeries", () => {
  it("14 个点、以 endDate 结尾、缺失日期补 0", () => {
    const series = buildDailySeries([at("2026-09-29T10:00:00", 30)], new Date(2026, 8, 29, 12));
    expect(series).toHaveLength(14);
    expect(series[13].label).toBe("9/29");
    expect(series[13].value).toBe(30);
    expect(series[0].value).toBe(0);
  });
});

describe("buildHeatmap", () => {
  it("12 周 × 7 天，最后一天是今天，且今天的分钟数正确", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
    const weeks = buildHeatmap([{ startedAt: today.toISOString(), durationSeconds: 3000 } as unknown as FocusSession]);
    expect(weeks).toHaveLength(12);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const last = weeks[weeks.length - 1][6];
    expect(last.key).toBe(localKey(now));
    expect(last.minutes).toBe(50);
  });

  it("now 可注入：跨年窗口也能钉死边界（v1.35.0 补）", () => {
    const now = new Date(2027, 0, 1, 12); // 2027-01-01
    const weeks = buildHeatmap(
      [at("2027-01-01T10:00:00", 20), at("2026-12-31T10:00:00", 40)],
      now
    );
    expect(weeks).toHaveLength(12);
    const last = weeks[weeks.length - 1][6];
    expect(last.key).toBe("2027-01-01");
    expect(last.minutes).toBe(20);
    // 84 天窗口的起点 = 2026-10-10（2026 年内）
    expect(weeks[0][0].key).toBe("2026-10-10");
  });
});

describe("heatColor", () => {
  it("四档色阶与图例一致", () => {
    expect(heatColor(0)).toBe(HEAT_LEGEND[0]);
    expect(heatColor(29)).toBe(HEAT_LEGEND[1]);
    expect(heatColor(59)).toBe(HEAT_LEGEND[2]);
    expect(heatColor(60)).toBe(HEAT_LEGEND[3]);
  });
});

describe("buildWeekCompare", () => {
  it("0..6 上周、7..13 本周，delta 为差值", () => {
    const last14 = Array.from({ length: 14 }, (_, i) => ({ minutes: i < 7 ? 10 : 30 }));
    expect(buildWeekCompare(last14)).toEqual({ thisWeek: 210, lastWeek: 70, delta: 140 });
  });

  it("不足 14 天 → null（新用户不显示环比）", () => {
    expect(buildWeekCompare([{ minutes: 30 }])).toBeNull();
  });
});

describe("buildPeakPeriod", () => {
  it("取累计分钟最多的时段，带小时区间文案", () => {
    const peak = buildPeakPeriod([
      at("2026-09-28T20:00:00", 40),
      at("2026-09-29T21:00:00", 50),
      at("2026-09-30T08:00:00", 20),
      { startedAt: "bad", durationSeconds: 600 } as unknown as FocusSession,
    ]);
    expect(peak).toEqual({ label: "晚上", range: "18:00–22:00", minutes: 90 });
  });

  it("没有任何有效会话 → null", () => {
    expect(buildPeakPeriod([])).toBeNull();
    expect(buildPeakPeriod([{ startedAt: "bad" } as unknown as FocusSession])).toBeNull();
  });
});

describe("buildHeatMonthMarks", () => {
  it("每列首天换月才标，同月为 null", () => {
    const weeks = [
      [{ key: "2026-09-01" }, { key: "2026-09-02" }],
      [{ key: "2026-09-07" }, { key: "2026-09-08" }],
      [{ key: "2026-10-05" }, { key: "2026-10-06" }],
    ];
    expect(buildHeatMonthMarks(weeks)).toEqual(["9月", null, "10月"]);
  });

  it("空列 → null（不推进月份游标）", () => {
    expect(buildHeatMonthMarks([[], [{ key: "2026-09-07" }]])).toEqual([null, "9月"]);
  });
});
