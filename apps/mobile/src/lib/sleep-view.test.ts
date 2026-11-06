import { describe, expect, it } from "vitest";
import {
  averageClockText,
  bedtimeOffsetMin,
  bedtimeStdMin,
  fallbackSleepScore,
  fallbackSleepStageSlices,
  fallbackSleepStats,
  mergeHealthNights,
  parseSleepDurationInput,
  regularityLabelOf,
  sleepClockText,
  sleepClockToIso,
  sleepHeatWeeks,
  sleepMinutesText,
  sleepMonthDay,
  sleepScoreRating,
  sleepStagePct,
  sleepWeekColumns,
  sleepWeekdayShort,
  shiftSleepDate,
  stageReferenceText,
  stageVerdict,
  type SleepNightLike,
} from "./sleep-view";

/** 固定一晚：23:30 睡、07:10 醒、7h40m、深 90 / 浅 260 / REM 100 / 清醒 10 */
function makeNight(overrides: Partial<SleepNightLike> = {}): SleepNightLike {
  const date = overrides.date ?? "2026-11-06";
  const bedtime = overrides.bedtime ?? new Date(2026, 10, 5, 23, 30).toISOString();
  const wakeTime = overrides.wakeTime ?? new Date(2026, 10, 6, 7, 10).toISOString();
  return {
    date,
    bedtime,
    wakeTime,
    durationMin: 460,
    timeInBedMin: 470,
    stages: { deep: 90, light: 260, rem: 100, awake: 10 },
    awakeCount: 2,
    efficiencyPct: 96,
    source: "health",
    updatedAt: "2026-11-06T07:10:00.000Z",
    ...overrides,
  };
}

describe("时长解析（手动补录输入）", () => {
  it("支持小数小时 / 冒号 / h+m / 分钟四种写法", () => {
    expect(parseSleepDurationInput("7.5")).toBe(450);
    expect(parseSleepDurationInput("7,5")).toBe(450);
    expect(parseSleepDurationInput("7:30")).toBe(450);
    expect(parseSleepDurationInput("7h30m")).toBe(450);
    expect(parseSleepDurationInput("7 小时 30 分")).toBe(450);
    expect(parseSleepDurationInput("7小时")).toBe(420);
    expect(parseSleepDurationInput("450")).toBe(450);
    expect(parseSleepDurationInput("450 分钟")).toBe(450);
    expect(parseSleepDurationInput("90min")).toBe(90);
  });

  it("非法 / 超范围输入一律 null（页面给一句提示，不弹错误框）", () => {
    expect(parseSleepDurationInput("")).toBeNull();
    expect(parseSleepDurationInput(null)).toBeNull();
    expect(parseSleepDurationInput("0")).toBeNull();
    expect(parseSleepDurationInput("-3")).toBeNull();
    expect(parseSleepDurationInput("7:70")).toBeNull();
    expect(parseSleepDurationInput("abc")).toBeNull();
    expect(parseSleepDurationInput("25h")).toBeNull();
    expect(parseSleepDurationInput("2000")).toBeNull();
  });
});

describe("文案兜底", () => {
  it("时长：7h32m / 48m / 脏数据「—」", () => {
    expect(sleepMinutesText(452)).toBe("7h32m");
    expect(sleepMinutesText(48)).toBe("48m");
    expect(sleepMinutesText(0)).toBe("—");
    expect(sleepMinutesText(null)).toBe("—");
    expect(sleepMinutesText(Number.NaN)).toBe("—");
  });

  it("时钟：ISO → 本地 HH:mm，非法值「—」", () => {
    expect(sleepClockText(new Date(2026, 10, 6, 7, 5).toISOString())).toBe("07:05");
    expect(sleepClockText("")).toBe("—");
    expect(sleepClockText("not-a-date")).toBe("—");
    expect(sleepClockText(null)).toBe("—");
  });

  it("日期：星期 / 短日期 / 位移跨月", () => {
    expect(sleepWeekdayShort("2026-11-06")).toBe("五");
    expect(sleepMonthDay("2026-11-06")).toBe("11/6");
    expect(shiftSleepDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftSleepDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(sleepMonthDay("bad")).toBe("");
  });

  it("手动时钟串 → ISO：入睡跨零点算前一晚，起床记在当天", () => {
    const bedtime = sleepClockToIso("2026-11-06", "23:30", "bedtime");
    const wake = sleepClockToIso("2026-11-06", "07:10", "wakeTime");
    expect(bedtime).toBe(new Date(2026, 10, 5, 23, 30).toISOString());
    expect(wake).toBe(new Date(2026, 10, 6, 7, 10).toISOString());
    // 00:30 入睡属于同一晚（起床日当天凌晨）
    expect(sleepClockToIso("2026-11-06", "00:30", "bedtime")).toBe(
      new Date(2026, 10, 6, 0, 30).toISOString()
    );
    expect(sleepClockToIso("2026-11-06", "24:00", "wakeTime")).toBeNull();
    expect(sleepClockToIso("2026-11-06", "7", "wakeTime")).toBeNull();
  });
});

describe("分期口径", () => {
  it("占比按「含清醒」的总分钟计算，合计 100%", () => {
    expect(sleepStagePct(null, "deep")).toBeNull();
    const night = makeNight();
    expect(sleepStagePct(night.stages, "deep")).toBe(19.6);
    const slices = fallbackSleepStageSlices(night);
    expect(slices).toHaveLength(4);
    expect(slices.map((s) => s.key)).toEqual(["deep", "light", "rem", "awake"]);
    expect(slices.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100, 0);
    expect(slices[0].label).toBe("深睡");
    expect(slices[3].label).toBe("清醒");
  });

  it("无 stages 时切片为空（页面走「系统未提供分期」）", () => {
    expect(fallbackSleepStageSlices(makeNight({ stages: null }))).toEqual([]);
  });

  it("参考区间文案与判定", () => {
    expect(stageReferenceText("deep")).toBe("参考 15–60%");
    expect(stageReferenceText("unknown")).toBe("");
    expect(stageVerdict("deep", 10)).toBe("偏低");
    expect(stageVerdict("deep", 25)).toBe("正常");
    expect(stageVerdict("deep", 80)).toBe("偏高");
    expect(stageVerdict("unknown", 50)).toBe("正常");
  });
});

describe("评分与统计兜底", () => {
  it("评分落在 0–100，评级文案分档", () => {
    const score = fallbackSleepScore(makeNight());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(fallbackSleepScore(null)).toBe(0);
    expect(fallbackSleepScore(makeNight({ durationMin: 0 }))).toBe(0);
    expect(sleepScoreRating(90)).toBe("优秀");
    expect(sleepScoreRating(78)).toBe("良好");
    expect(sleepScoreRating(62)).toBe("一般");
    expect(sleepScoreRating(45)).toBe("偏差");
    expect(sleepScoreRating(20)).toBe("较差");
    expect(sleepScoreRating(null)).toBe("暂无评分");
  });

  it("就寝偏移跨零点归一（23:30 → -30，00:30 → +30）", () => {
    expect(bedtimeOffsetMin(makeNight({ bedtime: new Date(2026, 10, 5, 23, 30).toISOString() }))).toBe(-30);
    expect(bedtimeOffsetMin(makeNight({ bedtime: new Date(2026, 10, 6, 0, 30).toISOString() }))).toBe(30);
    expect(bedtimeOffsetMin(makeNight({ bedtime: "" }))).toBeNull();
  });

  it("规律性：标准差与三档标签", () => {
    expect(bedtimeStdMin([-30])).toBeNull();
    expect(bedtimeStdMin([-30, -20, -40])).toBe(8);
    expect(regularityLabelOf(8)).toBe("规律");
    expect(regularityLabelOf(45)).toBe("一般");
    expect(regularityLabelOf(90)).toBe("不规律");
    expect(regularityLabelOf(null)).toBe("记录不足");
  });

  it("区间统计：只统计传入的窗口，缺项为 null", () => {
    const nights = [
      makeNight({ date: "2026-11-06" }),
      makeNight({
        date: "2026-11-05",
        durationMin: 420,
        efficiencyPct: 90,
        awakeCount: 0,
        stages: null,
        bedtime: new Date(2026, 10, 5, 23, 0).toISOString(),
      }),
    ];
    const stats = fallbackSleepStats(nights, 7);
    expect(stats.avgDurationMin).toBe(440);
    expect(stats.avgEfficiency).toBe(93);
    expect(stats.avgAwakeCount).toBe(1);
    expect(stats.avgDeepPct).toBe(19.6);
    expect(stats.regularityStdMin).toBe(15);
    expect(stats.regularityLabel).toBe("规律");

    const empty = fallbackSleepStats([], 7);
    expect(empty.avgDurationMin).toBeNull();
    expect(empty.regularityStdMin).toBeNull();
    expect(empty.regularityLabel).toBe("记录不足");
  });
});

describe("合并 / 窗口 / 热力", () => {
  it("health 覆盖同日 manual，其它 manual 保留，结果倒序", () => {
    const local = [
      makeNight({ date: "2026-11-02", source: "manual", durationMin: 300 }),
      makeNight({ date: "2026-11-01", source: "manual" }),
      makeNight({ date: "2026-10-20", source: "health" }),
    ];
    const health = [makeNight({ date: "2026-11-02", source: "health", durationMin: 480 })];
    const merged = mergeHealthNights(local, health);
    expect(merged.map((n) => n.date)).toEqual(["2026-11-02", "2026-11-01", "2026-10-20"]);
    expect(merged[0].durationMin).toBe(480);
    expect(merged[0].source).toBe("health");
    expect(merged[1].source).toBe("manual");
    expect(merged[2].date).toBe("2026-10-20");
  });

  it("周柱：7 天升序、缺记录补 0、今天高亮", () => {
    const columns = sleepWeekColumns([makeNight({ date: "2026-11-06" })], "2026-11-06", 7);
    expect(columns).toHaveLength(7);
    expect(columns[0].key).toBe("2026-10-31");
    expect(columns[6].key).toBe("2026-11-06");
    expect(columns[6].highlight).toBe(true);
    expect(columns[6].minutes).toBe(460);
    expect(columns[0].minutes).toBe(0);
    expect(columns[0].label).toBe("六");
  });

  it("月热力：周一起对齐、末格是今天、记录天数正确", () => {
    const nights = [makeNight({ date: "2026-11-06" }), makeNight({ date: "2026-11-03", durationMin: 240 })];
    const heat = sleepHeatWeeks(nights, "2026-11-06", { days: 30 });
    expect(heat.recordDays).toBe(2);
    expect(heat.max).toBe(460);
    const flat = heat.rows.flat();
    expect(flat.some((cell) => cell && cell.key === "2026-11-06")).toBe(true);
    for (const row of heat.rows) expect(row).toHaveLength(7);
    // 末行会补 null 到 7 的倍数，所以按日期找今天，而不是取数组最后一项
    const todayCell = flat.find((cell) => cell?.key === "2026-11-06");
    expect(todayCell?.level).toBe(4); // 最长的一晚是最深的一档
    expect(flat.length % 7).toBe(0);
    expect(heat.rows[0][0] === null || heat.rows[0][0]?.key === "2026-10-08").toBe(true);
  });

  it("平均钟点：非法 → 「—」", () => {
    expect(averageClockText([makeNight()], "bedtime")).toBe("23:30");
    expect(averageClockText([makeNight({ bedtime: "" })], "bedtime")).toBe("—");
  });
});
