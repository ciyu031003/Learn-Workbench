import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UNTAGGED_CONTENT, computeFocusStats } from "./focus-stats";

describe("computeFocusStats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 10, 0, 0)); // 2026-08-13 10:00 local
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes today sessions/minutes and the 14-day window", () => {
    const stats = computeFocusStats([
      { id: 1, taskId: null, startedAt: "2026-08-13T09:00:00", endedAt: "2026-08-13T09:25:00", durationSeconds: 1500, tag: null },
      { id: 2, taskId: null, startedAt: "2026-08-13T09:30:00", endedAt: "2026-08-13T09:55:00", durationSeconds: 1500, tag: null },
    ]);
    expect(stats.date).toBe("2026-08-13");
    expect(stats.todaySessions).toBe(2);
    expect(stats.todayMinutes).toBe(50);
    expect(stats.totalFocusDays).toBe(1);
    expect(stats.streak).toBe(1);
    expect(stats.last14).toHaveLength(14);
    expect(stats.todayList).toEqual([
      { startTime: "09:00", endTime: "09:25", minutes: 25, label: null, taskId: null },
      { startTime: "09:30", endTime: "09:55", minutes: 25, label: null, taskId: null },
    ]);
  });

  it("skips invalid dates and counts a multi-day streak", () => {
    const stats = computeFocusStats([
      { id: 1, taskId: null, startedAt: "not-a-date", endedAt: null, durationSeconds: 100, tag: null },
      { id: 2, taskId: null, startedAt: "2026-08-12T09:00:00", endedAt: "2026-08-12T09:30:00", durationSeconds: 1800, tag: null },
      { id: 3, taskId: null, startedAt: "2026-08-11T09:00:00", endedAt: "2026-08-11T09:30:00", durationSeconds: 1800, tag: null },
    ]);
    expect(stats.totalFocusDays).toBe(2);
    expect(stats.streak).toBe(2);
    expect(stats.todaySessions).toBe(0);
  });

  it("rounds durationSeconds down to whole minutes and clamps negatives", () => {
    const stats = computeFocusStats([
      { id: 1, taskId: null, startedAt: "2026-08-13T09:00:00", endedAt: "2026-08-13T09:00:50", durationSeconds: 50, tag: null },
      { id: 2, taskId: null, startedAt: "2026-08-13T10:00:00", endedAt: "2026-08-13T10:00:00", durationSeconds: -5, tag: null },
    ]);
    expect(stats.todayMinutes).toBe(1);
  });

  /**
   * v5 P2-2：学习内容维度（`focus_sessions.tag`）。
   * 边界：tag 为空/纯空白 → 「未分类」；分钟降序；本周窗口含今天、跨周边界正确。
   */
  describe("按学习内容聚合", () => {
    it("todayList 带出 label 与 taskId", () => {
      const stats = computeFocusStats([
        { id: 1, taskId: 7, startedAt: "2026-08-13T09:00:00", endedAt: "2026-08-13T09:25:00", durationSeconds: 1500, tag: "英语读写" },
        { id: 2, taskId: null, startedAt: "2026-08-13T10:00:00", endedAt: "2026-08-13T10:30:00", durationSeconds: 1800, tag: null },
      ]);
      expect(stats.todayList).toEqual([
        { startTime: "09:00", endTime: "09:25", minutes: 25, label: "英语读写", taskId: 7 },
        { startTime: "10:00", endTime: "10:30", minutes: 30, label: null, taskId: null },
      ]);
    });

    it("今日按内容聚合：tag 为空归「未分类」，分钟降序，同内容合并", () => {
      const stats = computeFocusStats([
        { id: 1, taskId: null, startedAt: "2026-08-13T08:00:00", endedAt: "2026-08-13T08:10:00", durationSeconds: 600, tag: "力扣刷题" },
        { id: 2, taskId: null, startedAt: "2026-08-13T09:00:00", endedAt: "2026-08-13T09:40:00", durationSeconds: 2400, tag: "英语读写" },
        { id: 3, taskId: null, startedAt: "2026-08-13T10:00:00", endedAt: "2026-08-13T10:20:00", durationSeconds: 1200, tag: "力扣刷题" },
        { id: 4, taskId: null, startedAt: "2026-08-13T11:00:00", endedAt: "2026-08-13T11:05:00", durationSeconds: 300, tag: null },
        { id: 5, taskId: null, startedAt: "2026-08-13T12:00:00", endedAt: "2026-08-13T12:05:00", durationSeconds: 300, tag: "   " },
      ]);
      expect(stats.byContent).toEqual([
        { label: "英语读写", minutes: 40, sessions: 1 },
        { label: "力扣刷题", minutes: 30, sessions: 2 },
        { label: UNTAGGED_CONTENT, minutes: 10, sessions: 2 },
      ]);
    });

    it("本周：含今天在内最近 7 天，跨周边界外的会话不计入", () => {
      const stats = computeFocusStats([
        // 今天（2026-08-13，周四）
        { id: 1, taskId: null, startedAt: "2026-08-13T09:00:00", endedAt: "2026-08-13T09:20:00", durationSeconds: 1200, tag: "英语读写" },
        // 第 7 天（08-07）：仍在窗口内（含今天往前数 7 天 → 08-07 ~ 08-13）
        { id: 2, taskId: null, startedAt: "2026-08-07T09:00:00", endedAt: "2026-08-07T09:30:00", durationSeconds: 1800, tag: "英语读写" },
        // 第 8 天（08-06）：窗口外，不应计入
        { id: 3, taskId: null, startedAt: "2026-08-06T09:00:00", endedAt: "2026-08-06T09:30:00", durationSeconds: 1800, tag: "英语读写" },
        // 更早：窗口外
        { id: 4, taskId: null, startedAt: "2026-07-20T09:00:00", endedAt: "2026-07-20T10:00:00", durationSeconds: 3600, tag: "力扣刷题" },
      ]);
      expect(stats.weekByContent).toEqual([{ label: "英语读写", minutes: 50, sessions: 2 }]);
      expect(stats.byContent).toEqual([{ label: "英语读写", minutes: 20, sessions: 1 }]);
    });

    it("无任何会话时两个维度都是空数组（不产生「未分类」噪声）", () => {
      const stats = computeFocusStats([]);
      expect(stats.byContent).toEqual([]);
      expect(stats.weekByContent).toEqual([]);
      expect(stats.todayList).toEqual([]);
    });
  });
});

/**
 * v5 P2 审查回归：0 分钟会话（10~29 秒）不产出内容分组行 ——
 * 否则"今天还没有绑定学习内容的专注"的空态会被一条 "0 分钟 · 1 次" 顶掉。
 */
describe("学习内容聚合 · 0 分钟会话", () => {
  it("20 秒的会话保留在 todayList（0 分钟）但不进 byContent", () => {
    const startedAt = new Date();
    const endedAt = new Date(startedAt.getTime() + 20_000);
    const stats = computeFocusStats([
      {
        id: 1,
        taskId: null,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: 20,
        tag: "英语读写",
      },
    ] as never);

    expect(stats.todayList).toHaveLength(1);
    expect(stats.todayList[0].label).toBe("英语读写");
    expect(stats.todayList[0].minutes).toBe(0);
    expect(stats.byContent).toHaveLength(0);
    expect(stats.weekByContent).toHaveLength(0);
  });
});