import { describe, expect, it } from "vitest";
import { FOCUS_MOTIVATIONS } from "@/lib/focus-stats";
import { focusShareDataFromStats, focusShareText } from "./focus-share";

const stats = (over: Record<string, unknown> = {}) =>
  ({
    todayMinutes: 128,
    todaySessions: 4,
    totalFocusDays: 88,
    streak: 12,
    last14: [
      { date: "2026-09-21", minutes: 30, sessions: 1 },
      { date: "2026-09-22", minutes: 128, sessions: 4 },
    ],
    ...over,
  }) as never;

/** v1.22：分享卡片的数据映射与文字兜底（卡片图片由 view-shot 截图，这里只测纯逻辑） */
describe("focusShareDataFromStats / focusShareText", () => {
  it("把统计映射成卡片数据（连续天数决定励志语）", () => {
    const d = focusShareDataFromStats(stats(), new Date(2026, 8, 22));
    expect(d.minutes).toBe(128);
    expect(d.sessions).toBe(4);
    expect(d.streak).toBe(12);
    expect(d.totalFocusDays).toBe(88);
    expect(d.dateText).toBe("2026-09-22");
    expect(d.last14).toHaveLength(2);
    expect(d.motivation).toBe(FOCUS_MOTIVATIONS[Math.min(12, FOCUS_MOTIVATIONS.length - 1)]);
  });

  it("脏数据不会污染卡片（负数 / NaN 归零，连续天数超界取最后一句）", () => {
    const d = focusShareDataFromStats(
      stats({ todayMinutes: Number.NaN, todaySessions: -3, streak: 999, totalFocusDays: Number.NaN }),
      new Date(2026, 0, 5)
    );
    expect(d.minutes).toBe(0);
    expect(d.sessions).toBe(0);
    expect(d.totalFocusDays).toBe(0);
    expect(d.motivation).toBe(FOCUS_MOTIVATIONS[FOCUS_MOTIVATIONS.length - 1]);
    expect(d.dateText).toBe("2026-01-05");
  });

  it("文字兜底包含四项关键信息", () => {
    const t = focusShareText(focusShareDataFromStats(stats(), new Date(2026, 8, 22)));
    expect(t).toContain("专注打卡");
    expect(t).toContain("2026-09-22");
    expect(t).toContain("连续专注 12 天");
    expect(t).toContain("今日专注 4 次 · 128 分钟");
  });
});
