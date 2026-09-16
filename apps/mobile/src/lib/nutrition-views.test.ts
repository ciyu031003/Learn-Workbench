import { describe, expect, it } from "vitest";
import {
  pickWindowSummary,
  compactKcal,
  dayLabel,
  groupThousands,
  summarizeRange,
  toDaySummaryMap,
  todayAndYesterday,
  weeksAgo,
  type DaySummaryRow,
} from "./nutrition-views";

const row = (date: string, kcal: number, entryCount = 1): DaySummaryRow => ({
  date,
  kcal,
  proteinG: 10,
  carbsG: 20,
  fatG: 5,
  entryCount,
});

/**
 * 饮食页 日/周/月 视图的纯计算回归：
 * ① 汇总口径（只算有记录的天，日均按记录天数算）
 * ② 今天/昨天标签（跨月、跨年边界）
 * ③ 脏数据（后端字段缺失/非数字）不能把页面算崩
 */
describe("toDaySummaryMap", () => {
  it("只保留有记录的天，并裁掉时间后缀", () => {
    const map = toDaySummaryMap([
      { date: "2026-09-16T00:00:00.000Z", kcal: 1549.4, proteinG: 60, carbsG: 180, fatG: 50, entryCount: 4 },
      { date: "2026-09-15", kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 0 },
    ]);
    expect(Object.keys(map)).toEqual(["2026-09-16"]);
    expect(map["2026-09-16"]).toMatchObject({ date: "2026-09-16", kcal: 1549, entryCount: 4 });
  });

  it("非数组 / 缺字段 / 非数字都能安全降级", () => {
    expect(toDaySummaryMap(null)).toEqual({});
    expect(toDaySummaryMap([null, 3, { kcal: 100 }])).toEqual({});
    const map = toDaySummaryMap([{ date: "2026-09-16", entryCount: 2, kcal: "abc" }]);
    expect(map["2026-09-16"]).toMatchObject({ kcal: 0, entryCount: 2 });
  });
});

describe("summarizeRange", () => {
  it("只统计有记录的天，日均按记录天数（不是日历天数）", () => {
    const s = summarizeRange([row("2026-09-14", 1000), row("2026-09-15", 0, 0), row("2026-09-16", 2000)]);
    expect(s.kcal).toBe(3000);
    expect(s.daysLogged).toBe(2);
    expect(s.avgKcal).toBe(1500);
    expect(s.proteinG).toBe(20);
  });

  it("空区间不产生 NaN", () => {
    expect(summarizeRange([])).toEqual({ kcal: 0, daysLogged: 0, avgKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("todayAndYesterday / dayLabel", () => {
  it("今天/昨天用本地日计算（跨月正确）", () => {
    const { today, yesterday } = todayAndYesterday(new Date(2026, 9, 1)); // 10-01
    expect(today).toBe("2026-10-01");
    expect(yesterday).toBe("2026-09-30");
  });

  it("标签：今天 / 昨天 / 同年 M月D日 / 跨年补年份", () => {
    expect(dayLabel("2026-09-16", "2026-09-16")).toBe("今天");
    expect(dayLabel("2026-09-15", "2026-09-16")).toBe("昨天");
    expect(dayLabel("2026-09-01", "2026-09-16")).toBe("9月1日");
    // 跨年但不是"昨天"：要补年份
    expect(dayLabel("2025-12-20", "2026-01-01")).toBe("2025年12月20日");
  });
});

describe("compactKcal", () => {
  it("1000 以上折成 k，个位不丢（月历格子放得下）", () => {
    expect(compactKcal(0)).toBe("");
    expect(compactKcal(320)).toBe("320");
    expect(compactKcal(1549)).toBe("1.5k");
    expect(compactKcal(12345)).toBe("12k");
  });
});

describe("groupThousands", () => {
  it("按三位分组，跨端输出恒定（不依赖 Intl）", () => {
    expect(groupThousands(0)).toBe("0");
    expect(groupThousands(7)).toBe("7");
    expect(groupThousands(999)).toBe("999");
    expect(groupThousands(1000)).toBe("1,000");
    expect(groupThousands(1549)).toBe("1,549");
    expect(groupThousands(12345)).toBe("12,345");
    expect(groupThousands(1234567)).toBe("1,234,567");
  });

  it("负数与非法值不产生怪字符串（图表/水杯都直接渲染它）", () => {
    expect(groupThousands(-1549)).toBe("-1,549");
    expect(groupThousands(Number.NaN)).toBe("0");
    expect(groupThousands(Number.POSITIVE_INFINITY)).toBe("0");
    expect(groupThousands(1549.4)).toBe("1,549");
  });
});

describe("weeksAgo", () => {
  it("今天=0、本周内=0、跨周按整周取整", () => {
    expect(weeksAgo("2026-09-16", "2026-09-16")).toBe(0);
    expect(weeksAgo("2026-09-13", "2026-09-16")).toBe(0);
    expect(weeksAgo("2026-09-09", "2026-09-16")).toBe(1);
    expect(weeksAgo("2026-09-02", "2026-09-16")).toBe(2);
  });

  it("未来日期按 0 处理，并按 maxWeeks 截断（日期条只能回看 4 周）", () => {
    expect(weeksAgo("2026-10-01", "2026-09-16")).toBe(0);
    expect(weeksAgo("2020-01-01", "2026-09-16", 4)).toBe(4);
  });
});

/**
 * 窗口绑定回归（P4-1 审查发现）：切视图/翻月的过渡期，旧窗口的汇总绝不能拿来渲染新窗口。
 */
describe("pickWindowSummary", () => {
  const state = { key: "31:2026-09-30", map: { "2026-09-01": { kcal: 1500 } } };

  it("窗口一致时返回数据", () => {
    expect(pickWindowSummary(state, "31:2026-09-30")).toEqual(state.map);
  });

  it("窗口不一致 → null（消费方显示为空，而不是上一个窗口的数字）", () => {
    expect(pickWindowSummary(state, "1:2026-09-16")).toBeNull();
    expect(pickWindowSummary(state, "28:2026-09-16")).toBeNull();
  });

  it("空 key（尚未请求过）→ null", () => {
    expect(pickWindowSummary({ key: "", map: {} }, "1:2026-09-16")).toBeNull();
  });
});