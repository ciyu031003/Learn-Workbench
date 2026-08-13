import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeFocusStats } from "./focus-stats";

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
      { startTime: "09:00", endTime: "09:25", minutes: 25 },
      { startTime: "09:30", endTime: "09:55", minutes: 25 },
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
});
