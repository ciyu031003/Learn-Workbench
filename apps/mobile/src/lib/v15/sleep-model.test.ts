import { describe, expect, it } from "vitest";
import { bedtimeWindow, buildSleepInsights, formatSleepDuration, sleepAchievementPct, sleepDebtMinutes } from "./sleep-model";

describe("v15 sleep model", () => {
  it("时长格式化", () => {
    expect(formatSleepDuration(432)).toBe("7h 12m");
    expect(formatSleepDuration(45)).toBe("45m");
    expect(formatSleepDuration(0)).toBe("—");
  });

  it("睡眠债按 7 晚累计", () => {
    expect(sleepDebtMinutes(440)).toBe(70);
    expect(sleepDebtMinutes(450)).toBe(0);
    expect(sleepDebtMinutes(null)).toBeNull();
  });

  it("达成率封顶 100", () => {
    expect(sleepAchievementPct(400)).toBe(89);
    expect(sleepAchievementPct(600)).toBe(100);
  });

  it("入睡窗口取均值 ±15 分钟并跨零点", () => {
    expect(bedtimeWindow([-60, -40])?.label).toBe("22:55 – 23:25");
    expect(bedtimeWindow([-60])).toBeNull();
  });

  it("洞察只从真实指标生成", () => {
    const insights = buildSleepInsights({
      avgDurationMin: 420,
      deepPct: 12,
      regularityStdMin: 22,
      awakeAvg: 3,
      metNights: 1,
    });
    expect(insights.map((item) => item.key)).toEqual(["regularity", "deep", "debt"]);
    expect(insights[0].tone).toBe("green");
    expect(insights[1].tone).toBe("red");
  });
});


