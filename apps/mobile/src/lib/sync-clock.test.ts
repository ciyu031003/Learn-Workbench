import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CLOCK_SKEW_WARN_MS,
  __resetServerClockForTests,
  clockSkewHint,
  getServerClockOffsetMs,
  getServerClockSample,
  hasServerClockSample,
  isClockSkewed,
  noteServerTime,
  subscribeServerClock,
} from "./sync-clock";

beforeEach(() => {
  __resetServerClockForTests();
});

describe("服务端时钟偏移（S5-3）", () => {
  it("记录 serverTime - deviceTime", () => {
    expect(hasServerClockSample()).toBe(false);
    const offset = noteServerTime("2026-08-13T11:00:00.000Z", new Date("2026-08-13T10:00:00.000Z").getTime());
    expect(offset).toBe(60 * 60_000);
    expect(getServerClockOffsetMs()).toBe(60 * 60_000);
    expect(getServerClockSample()?.sampledAt).toBe(new Date("2026-08-13T10:00:00.000Z").getTime());
  });

  it("非法 serverTime 不污染已有样本", () => {
    noteServerTime("2026-08-13T10:05:00.000Z", new Date("2026-08-13T10:00:00.000Z").getTime());
    const before = getServerClockOffsetMs();
    expect(noteServerTime("not-a-date", 0)).toBe(before);
    expect(getServerClockOffsetMs()).toBe(before);
  });

  it(">5min 才算跑偏（正好 5min 不提示）", () => {
    const base = new Date("2026-08-13T10:00:00.000Z").getTime();
    noteServerTime(base + CLOCK_SKEW_WARN_MS, base);
    expect(isClockSkewed()).toBe(false);
    noteServerTime(base + CLOCK_SKEW_WARN_MS + 1, base);
    expect(isClockSkewed()).toBe(true);
    noteServerTime(base - CLOCK_SKEW_WARN_MS - 60_000, base);
    expect(isClockSkewed()).toBe(true);
  });

  it("clockSkewHint 说明快/慢方向", () => {
    expect(clockSkewHint(62 * 60_000)).toContain("慢约 62 分钟");
    expect(clockSkewHint(-62 * 60_000)).toContain("快约 62 分钟");
  });

  it("订阅者在采样时被通知", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeServerClock(listener);
    noteServerTime("2026-08-13T10:00:00.000Z", new Date("2026-08-13T10:00:00.000Z").getTime());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    noteServerTime("2026-08-13T10:01:00.000Z", Date.now());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
