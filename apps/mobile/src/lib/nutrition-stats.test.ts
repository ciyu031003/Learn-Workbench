import { describe, expect, it } from "vitest";
import { daysInMonth } from "./month-grid";
import type { DaySummaryRow } from "./nutrition-views";
import {
  buildHeatmapWeeks,
  buildTrendSeries,
  formatDelta,
  heatLevel,
  loggedDaysInMonth,
  mergeSummaryMaps,
  monthWindowsBack,
  planDayEntryFetches,
} from "./nutrition-stats";

const row = (date: string, kcal: number): DaySummaryRow => ({
  date,
  kcal,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  entryCount: 1,
});

const mapOf = (...rows: DaySummaryRow[]) => Object.fromEntries(rows.map((r) => [r.date, r]));

describe("buildTrendSeries · 近 7 天曲线", () => {
  it("返回 7 个点（从早到晚），最后一个是 endKey", () => {
    const s = buildTrendSeries({}, "2026-09-16", 7);
    expect(s.current).toHaveLength(7);
    expect(s.current[6].key).toBe("2026-09-16");
    expect(s.current[0].key).toBe("2026-09-10");
  });

  it("横轴用星期标签，且与 monthGrid 的周日为第一列一致", () => {
    // 2026-09-16 是周三
    const s = buildTrendSeries({}, "2026-09-16", 7);
    expect(s.current[6].label).toBe("三");
    expect(s.current[5].label).toBe("二");
    expect(s.current[0].label).toBe("四");
  });

  it("汇总口径：总量 / 按全部天数平均（与「吃一点」Avg 口径一致）/ 峰值 / 有记录天数", () => {
    const map = mapOf(row("2026-09-14", 2000), row("2026-09-16", 1500), row("2026-09-11", 3908));
    const s = buildTrendSeries(map, "2026-09-16", 7);
    expect(s.totalKcal).toBe(7408);
    expect(s.avgKcal).toBe(Math.round(7408 / 7));
    expect(s.daysLogged).toBe(3);
    expect(s.peakKcal).toBe(3908);
    expect(s.peakKey).toBe("2026-09-11");
  });

  it("上一周期对比：有数据给百分比，没有则 null（不显示 ∞%）", () => {
    const map = mapOf(row("2026-09-16", 1200), row("2026-09-09", 800));
    const s = buildTrendSeries(map, "2026-09-16", 7);
    expect(s.prior).toHaveLength(7);
    expect(s.priorTotalKcal).toBe(800);
    expect(s.deltaPct).toBe(50);

    const empty = buildTrendSeries(mapOf(row("2026-09-16", 1200)), "2026-09-16", 7);
    expect(empty.priorTotalKcal).toBe(0);
    expect(empty.deltaPct).toBeNull();
  });

  it("窗口外的数据一律忽略（月视图会喂进来一整月）", () => {
    const map = mapOf(row("2026-09-16", 100), row("2026-09-01", 9999));
    const s = buildTrendSeries(map, "2026-09-16", 7);
    expect(s.totalKcal).toBe(100);
  });

  it("entryCount = 0 的行按 0 处理（summary 会补零）", () => {
    const map: Record<string, DaySummaryRow> = { "2026-09-16": { ...row("2026-09-16", 0), entryCount: 0 } };
    const s = buildTrendSeries(map, "2026-09-16", 7);
    expect(s.totalKcal).toBe(0);
    expect(s.current[6].logged).toBe(false);
  });
});

describe("heatLevel · 档位", () => {
  it("没记录 → 0", () => {
    expect(heatLevel(0, 2000)).toBe(0);
    expect(heatLevel(Number.NaN, 2000)).toBe(0);
  });

  it("按目标热量分档（跨月可比）", () => {
    expect(heatLevel(300, 2000)).toBe(1);
    expect(heatLevel(900, 2000)).toBe(2);
    expect(heatLevel(1600, 2000)).toBe(3);
    expect(heatLevel(2400, 2000)).toBe(4);
  });

  it("没有参照值时回落到中间档（而不是全黑/全白）", () => {
    expect(heatLevel(500, 0)).toBe(2);
  });
});

describe("buildHeatmapWeeks · 6 个月点阵", () => {
  const endKey = "2026-09-16"; // 周三
  const weeks = 26;

  it("列=周、行=周日→周六，且最后一列包含 endKey", () => {
    const { weeks: grid } = buildHeatmapWeeks({}, endKey, weeks);
    expect(grid).toHaveLength(weeks);
    expect(grid.every((c) => c.length === 7)).toBe(true);
    const last = grid[grid.length - 1];
    expect(last[3].key).toBe(endKey); // 周三 → 行下标 3
    expect(last[3].inRange).toBe(true);
    // endKey 之后（周四~周六）是未来，必须标记 out of range
    expect(last[4].inRange).toBe(false);
    expect(last[6].inRange).toBe(false);
  });

  it("跨度正好覆盖 weeks*7 天，不重不漏", () => {
    const { weeks: grid } = buildHeatmapWeeks({}, endKey, weeks);
    const keys = grid.flat().map((c) => c.key);
    expect(new Set(keys).size).toBe(weeks * 7);
    expect(keys[0]).toBe("2026-03-22"); // 26 周前的周日
  });

  it("统计有记录天数与峰值，并按参照值给出档位", () => {
    const map = mapOf(row("2026-09-16", 2000), row("2026-09-15", 400), row("2026-03-22", 1000));
    const { weeks: grid, maxKcal, loggedDays } = buildHeatmapWeeks(map, endKey, weeks);
    expect(maxKcal).toBe(2000);
    expect(loggedDays).toBe(3);
    const flat = grid.flat();
    expect(flat.find((c) => c.key === "2026-09-16")?.level).toBe(4);
    expect(flat.find((c) => c.key === "2026-09-15")?.level).toBe(1);
    expect(flat.find((c) => c.key === "2026-09-14")?.level).toBe(0);
  });

  it("未来格子即使 map 里有数据也不算入（防御异常数据）", () => {
    const map = mapOf(row("2026-09-20", 3000));
    const { loggedDays, maxKcal } = buildHeatmapWeeks(map, endKey, weeks);
    expect(loggedDays).toBe(0);
    expect(maxKcal).toBe(0);
  });

  it("月份刻度存在且随时间递增、彼此不挤在一起", () => {
    const { monthLabels } = buildHeatmapWeeks({}, endKey, weeks);
    expect(monthLabels.length).toBeGreaterThan(3);
    for (let i = 1; i < monthLabels.length; i += 1) {
      expect(monthLabels[i].column - monthLabels[i - 1].column).toBeGreaterThanOrEqual(3);
    }
  });

  it("传了目标热量时按目标分档（跨月可比），不传则按区间峰值", () => {
    const map = mapOf(row("2026-09-16", 500), row("2026-09-15", 2000));
    // 按峰值（2000）分档：500/2000 = 0.25 → 1 档
    const byPeak = buildHeatmapWeeks(map, "2026-09-16", 26);
    expect(byPeak.weeks.flat().find((c) => c.key === "2026-09-16")?.level).toBe(1);
    // 按目标（1000）分档：500/1000 = 0.5 → 2 档
    const byTarget = buildHeatmapWeeks(map, "2026-09-16", 26, 1000);
    expect(byTarget.weeks.flat().find((c) => c.key === "2026-09-16")?.level).toBe(2);
    // 参照值无效时回落到峰值，不会全变中间档
    const invalid = buildHeatmapWeeks(map, "2026-09-16", 26, 0);
    expect(invalid.weeks.flat().find((c) => c.key === "2026-09-15")?.level).toBe(4);
  });

  it("weeks 参数被夹到合理区间（1..53）", () => {
    expect(buildHeatmapWeeks({}, endKey, 0).weeks).toHaveLength(26);
    expect(buildHeatmapWeeks({}, endKey, 999).weeks).toHaveLength(53);
  });
});

describe("monthWindowsBack · 6 个月取数窗口", () => {
  it("返回从旧到新的 6 个自然月，每月 end 是该月最后一天（当月到今天）", () => {
    const wins = monthWindowsBack("2026-09-16", 6);
    expect(wins.map((w) => w.key)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(wins[0]).toMatchObject({ days: 30, end: "2026-04-30" });
    expect(wins[1].days).toBe(31); // 5 月
    expect(wins[5]).toMatchObject({ days: 16, end: "2026-09-16" }); // 当月只到今天
  });

  it("每月天数与 daysInMonth 一致（含 2 月闰年）", () => {
    const wins = monthWindowsBack("2024-03-05", 3);
    expect(wins[1]).toMatchObject({ key: "2024-02", days: 29, end: "2024-02-29" });
    expect(wins[1].days).toBe(daysInMonth(2024, 1));
  });

  it("跨年时仍然连续", () => {
    const wins = monthWindowsBack("2026-02-10", 4);
    expect(wins.map((w) => w.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("months 参数被夹到 1..24", () => {
    expect(monthWindowsBack("2026-09-16", 0)).toHaveLength(6);
    expect(monthWindowsBack("2026-09-16", 100)).toHaveLength(24);
  });
});

describe("mergeSummaryMaps / loggedDaysInMonth", () => {
  it("合并多个月份的 map", () => {
    const merged = mergeSummaryMaps([mapOf(row("2026-08-01", 100)), null, mapOf(row("2026-09-01", 200))]);
    expect(Object.keys(merged).sort()).toEqual(["2026-08-01", "2026-09-01"]);
  });

  it("只返回当月有记录的日期，新→旧，并按 cap 截断", () => {
    const map = mapOf(
      row("2026-09-02", 100),
      row("2026-09-10", 100),
      row("2026-09-05", 100),
      row("2026-08-31", 100)
    );
    expect(loggedDaysInMonth(map, 2026, 8)).toEqual(["2026-09-10", "2026-09-05", "2026-09-02"]);
    expect(loggedDaysInMonth(map, 2026, 8, 2)).toEqual(["2026-09-10", "2026-09-05"]);
  });
});

describe("formatDelta", () => {
  it("无对比 / 持平 / 增 / 减", () => {
    expect(formatDelta(null)).toBeNull();
    expect(formatDelta(0)).toBe("与上一周期持平");
    expect(formatDelta(66)).toBe("比上一周期多 66%");
    expect(formatDelta(-12)).toBe("比上一周期少 12%");
  });
});

describe("planDayEntryFetches · Food Calendar 补拉计划", () => {
  const wanted = ["2026-09-10", "2026-09-08", "2026-09-03"];

  it("只拉没拉过的，保持调用方给的顺序（新→旧）", () => {
    expect(planDayEntryFetches(["2026-09-08"], wanted)).toEqual(["2026-09-10", "2026-09-03"]);
  });

  it("过滤非法日期键（后端会因此报错）", () => {
    expect(planDayEntryFetches([], ["2026-9-1", "", "junk", "2026-09-03"])).toEqual(["2026-09-03"]);
  });

  it("cap 截断最坏情况（整月都有记录时也不打 31 个并发）", () => {
    const many = Array.from({ length: 31 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    expect(planDayEntryFetches([], many, 5)).toHaveLength(5);
    expect(planDayEntryFetches([], many, 5)[0]).toBe("2026-09-01");
  });

  it("同一批里重复的日期只规划一次", () => {
    expect(planDayEntryFetches([], ["2026-09-10", "2026-09-10"])).toEqual(["2026-09-10"]);
  });
});

/**
 * P4-c 审查回归（口径统一）：手动录入但没填热量（kcal=0）的天，月历算"有记录"、
 * 点阵/曲线也必须算"有记录"，否则同屏两个"有记录天数"打架。
 */
describe("有记录口径统一（entryCount 而非 kcal）", () => {
  const map = {
    "2026-09-01": { date: "2026-09-01", kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 1 },
    "2026-09-02": { date: "2026-09-02", kcal: 500, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 2 },
  };

  it("曲线：kcal=0 但有记录 → logged 为真", () => {
    const series = buildTrendSeries(map, "2026-09-02", 7);
    const day1 = series.current.find((d) => d.key === "2026-09-01");
    expect(day1?.logged).toBe(true);
    expect(day1?.kcal).toBe(0);
  });

  it("点阵：kcal=0 但有记录 → 计入 loggedDays 且给最低档 1（不是 0 档不可见）", () => {
    const heat = buildHeatmapWeeks(map, "2026-09-02", 4);
    const cell = heat.weeks.flat().find((c) => c.key === "2026-09-01");
    expect(heat.loggedDays).toBe(2);
    expect(cell?.level).toBe(1);
  });
});