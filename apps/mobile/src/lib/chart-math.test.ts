import { describe, expect, it } from "vitest";
import {
  activityRingLayout,
  arcPath,
  areaPath,
  barHeight,
  barShares,
  buildHeatmapMonth,
  clamp01,
  deltaDirection,
  deltaTone,
  formatDelta,
  formatMonthDayRange,
  formatPercent,
  heatAlpha,
  heatLevel,
  linePath,
  mapSeriesPoints,
  normalizeByMax,
  normalizeMinMax,
  pickSeriesColor,
  polarPoint,
  polygonPoints,
  radarAxisAngles,
  radarLabelAnchor,
  radarPoints,
  ringDash,
  segmentArcs,
  shareOf,
  withAlpha,
} from "./chart-math";

/**
 * 图表纯函数（v2.1 数据面板组件库的几何/归一/文案口径）。
 *
 * 这些函数是 8 个图表组件的唯一计算来源，边界全部在这里锁死：
 * 脏数据（NaN/负值/空数组）、角度回绕、环半径收敛、月历周一起补位、路径闭合。
 */

describe("clamp01 / normalize", () => {
  it("clamp01 夹到 0..1，脏数据归 0", () => {
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(9)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("normalizeMinMax 线性归一，区间非法时返回 0", () => {
    expect(normalizeMinMax(5, 0, 10)).toBe(0.5);
    expect(normalizeMinMax(15, 0, 10)).toBe(1);
    expect(normalizeMinMax(-5, 0, 10)).toBe(0);
    // max ≤ min（如单日全是同一个值）不能除零
    expect(normalizeMinMax(5, 10, 10)).toBe(0);
    expect(normalizeMinMax(Number.NaN, 0, 10)).toBe(0);
  });

  it("normalizeByMax 按序列最大值归一，负值按 0", () => {
    expect(normalizeByMax([2, 4, 8])).toEqual([0.25, 0.5, 1]);
    expect(normalizeByMax([-2, 4, 8])).toEqual([0, 0.5, 1]);
  });

  it("normalizeByMax 对空/全零/全脏数据返回等长全 0", () => {
    expect(normalizeByMax([])).toEqual([]);
    expect(normalizeByMax([0, 0])).toEqual([0, 0]);
    expect(normalizeByMax([Number.NaN, -1])).toEqual([0, 0]);
  });

  it("barHeight 至少有可见高度，越界值不溢出", () => {
    expect(barHeight(0.5, 100)).toBe(50);
    expect(barHeight(0, 100)).toBe(3);
    expect(barHeight(2, 100)).toBe(100);
    expect(barHeight(Number.NaN, 100)).toBe(3);
    // 画布高度为 0 时不允许"最矮 3px"撑出容器
    expect(barHeight(0.5, 0)).toBe(0);
  });

  it("shareOf / barShares 给出占比与条宽比例", () => {
    expect(shareOf(3, 4)).toBe(0.75);
    expect(shareOf(3, 0)).toBe(0);
    expect(shareOf(Number.NaN, 4)).toBe(0);
    expect(barShares([5, 10])).toEqual([0.5, 1]);
    expect(barShares([5, 10], 20)).toEqual([0.25, 0.5]);
    expect(barShares([0, 0])).toEqual([0, 0]);
    expect(barShares([-1, 4])).toEqual([0, 1]);
  });
});

describe("polarPoint / arcPath", () => {
  it("极坐标：0° 在 3 点钟、-90° 在 12 点钟、180° 在 9 点钟", () => {
    const right = polarPoint(50, 50, 40, 0);
    expect(right.x).toBeCloseTo(90, 6);
    expect(right.y).toBeCloseTo(50, 6);
    const top = polarPoint(50, 50, 40, -90);
    expect(top.x).toBeCloseTo(50, 6);
    expect(top.y).toBeCloseTo(10, 6);
    const left = polarPoint(50, 50, 40, 180);
    expect(left.x).toBeCloseTo(10, 6);
    expect(left.y).toBeCloseTo(50, 6);
  });

  it("arcPath 对空段/零半径返回 null（组件据此跳过而不是画错线）", () => {
    expect(arcPath(50, 50, 40, 30, 30)).toBeNull();
    expect(arcPath(50, 50, 40, 60, 20)).toBeNull();
    expect(arcPath(50, 50, 0, 0, 90)).toBeNull();
  });

  it("arcPath 的 largeArc 在 >180° 时为 1，并在 360° 处封顶", () => {
    const quarter = arcPath(50, 50, 40, -90, 0);
    expect(quarter).toBe("M 50 10 A 40 40 0 0 1 90 50");
    const threeQuarter = arcPath(50, 50, 40, 0, 270);
    expect(threeQuarter).toBe("M 90 50 A 40 40 0 1 1 50 10");
    // 单条 A 命令画不出整圈，必须封顶成 359.99°
    const full = arcPath(50, 50, 40, 0, 360);
    expect(full).not.toBeNull();
    expect(full).toContain("A 40 40 0 1 1");
  });

  it("segmentArcs 按比例分 360°、段间留空隙", () => {
    const arcs = segmentArcs([1, 1, 1, 1], 10);
    expect(arcs).toHaveLength(4);
    expect(arcs[0].start).toBe(-90);
    expect(arcs[0].end).toBeCloseTo(-10, 6);
    expect(arcs[1].start).toBeCloseTo(0, 6);
    expect(arcs.map((a) => a.ratio)).toEqual([0.25, 0.25, 0.25, 0.25]);
    // 可用角度 = 360 - 4×10
    const sweep = arcs.reduce((acc, a) => acc + (a.end - a.start), 0);
    expect(sweep).toBeCloseTo(320, 6);
    // 相邻段之间正好一个 gap
    for (let i = 1; i < arcs.length; i += 1) {
      expect(arcs[i].start - arcs[i - 1].end).toBeCloseTo(10, 6);
    }
  });

  it("segmentArcs 保留 0 值段（图例不能消失），总和为 0 时返回空数组", () => {
    const arcs = segmentArcs([1, 0, 1], 10);
    expect(arcs).toHaveLength(3);
    expect(arcs[1].ratio).toBe(0);
    expect(arcs[1].end).toBeCloseTo(arcs[1].start, 6);
    expect(segmentArcs([0, 0, 0])).toEqual([]);
    expect(segmentArcs([])).toEqual([]);
    expect(segmentArcs([-1, Number.NaN])).toEqual([]);
  });

  it("segmentArcs 在段数很多时把空隙总量封顶在 180°", () => {
    const arcs = segmentArcs(Array.from({ length: 40 }, () => 1), 8);
    // gap 取 180/40 = 4.5，而不是 8
    expect(arcs[1].start - arcs[0].end).toBeCloseTo(4.5, 6);
    const sweep = arcs.reduce((acc, a) => acc + (a.end - a.start), 0);
    expect(sweep).toBeCloseTo(180, 6);
  });
});

describe("ring / palette", () => {
  it("ringDash 用周长制给出 dasharray / dashoffset", () => {
    expect(ringDash(100, 0.5)).toEqual({ dasharray: "100 100", dashoffset: 50 });
    expect(ringDash(100, 1)).toEqual({ dasharray: "100 100", dashoffset: 0 });
    expect(ringDash(100, 0)).toEqual({ dasharray: "100 100", dashoffset: 100 });
    // 越界与脏数据都夹回 0..1
    expect(ringDash(100, 2).dashoffset).toBe(0);
    expect(ringDash(100, Number.NaN).dashoffset).toBe(100);
  });

  it("activityRingLayout 由外到内等距排环", () => {
    const rings = activityRingLayout(150, 3, 12, 6, 2);
    expect(rings.map((r) => r.radius)).toEqual([67, 49, 31]);
    expect(rings[0].circumference).toBeCloseTo(2 * Math.PI * 67, 6);
    expect(rings.every((r) => r.strokeWidth === 12)).toBe(true);
    // 环间净空 = gap
    expect(rings[0].radius - rings[1].radius).toBe(12 + 6);
  });

  it("activityRingLayout 收不进的环宁可不画，也不重叠", () => {
    // 尺寸 100、厚 30：外环半径 35，第二环只剩 1 < 半根描边 15 → 停
    expect(activityRingLayout(100, 4, 30, 4)).toHaveLength(1);
    expect(activityRingLayout(0, 3)).toEqual([]);
    expect(activityRingLayout(120, 0)).toEqual([]);
  });

  it("pickSeriesColor 越界回绕、负数安全、空板返回 transparent", () => {
    const palette = ["a", "b", "c"];
    expect(pickSeriesColor(palette, 0)).toBe("a");
    expect(pickSeriesColor(palette, 3)).toBe("a");
    expect(pickSeriesColor(palette, 4)).toBe("b");
    expect(pickSeriesColor(palette, -1)).toBe("c");
    expect(pickSeriesColor(palette, Number.NaN)).toBe("a");
    expect(pickSeriesColor([], 2)).toBe("transparent");
  });
});

describe("withAlpha", () => {
  it("十六进制（3/6 位）转 rgba", () => {
    expect(withAlpha("#4777E8", 0.4)).toBe("rgba(71, 119, 232, 0.4)");
    expect(withAlpha("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });

  it("rgba() 覆盖原透明度（深色档 token 本身就是 rgba）", () => {
    expect(withAlpha("rgba(71,119,232,0.22)", 0.5)).toBe("rgba(71, 119, 232, 0.5)");
    expect(withAlpha("rgb(10, 20, 30)", 0.2)).toBe("rgba(10, 20, 30, 0.2)");
  });

  it("透明度夹到 0..1，认不出的写法原样返回", () => {
    expect(withAlpha("#000000", 2)).toBe("rgba(0, 0, 0, 1)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
    expect(withAlpha("", 0.5)).toBe("");
  });
});

describe("heatLevel / heatAlpha", () => {
  it("0 档 = 无数据/零值，非零值至少 1 档", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(-3, 10)).toBe(0);
    expect(heatLevel(Number.NaN, 10)).toBe(0);
    expect(heatLevel(0.2, 10, 4)).toBe(1);
  });

  it("按比例分 4 档，超过上界封顶", () => {
    expect(heatLevel(2.5, 10, 4)).toBe(1);
    expect(heatLevel(5, 10, 4)).toBe(2);
    expect(heatLevel(7.5, 10, 4)).toBe(3);
    expect(heatLevel(10, 10, 4)).toBe(4);
    expect(heatLevel(99, 10, 4)).toBe(4);
    // 上界非法时按 1 处理（一次记录就点满，总比全白强）
    expect(heatLevel(1, 0, 4)).toBe(4);
  });

  it("heatAlpha 单调递增，0 档透明、最高档不透明", () => {
    expect(heatAlpha(0, 4)).toBe(0);
    expect(heatAlpha(1, 4)).toBe(0.16);
    expect(heatAlpha(2, 4)).toBe(0.44);
    expect(heatAlpha(3, 4)).toBe(0.72);
    expect(heatAlpha(4, 4)).toBe(1);
    expect(heatAlpha(9, 4)).toBe(1);
    expect(heatAlpha(1, 1)).toBe(1);
  });
});

describe("buildHeatmapMonth", () => {
  it("周一起：2026-09-01 是周二 → 前置补 1 格，35 格 / 5 周", () => {
    const grid = buildHeatmapMonth({ year: 2026, month: 8 });
    expect(grid.cells[0]).toBeNull();
    expect(grid.cells[1]?.key).toBe("2026-09-01");
    expect(grid.cells[1]?.weekday).toBe(1);
    expect(grid.cells).toHaveLength(35);
    expect(grid.weeks).toBe(5);
  });

  it("2026-11-01 是周日 → 周一起时前置补 6 格，42 格 / 6 周", () => {
    const grid = buildHeatmapMonth({ year: 2026, month: 10 });
    expect(grid.cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid.cells[6]?.key).toBe("2026-11-01");
    expect(grid.cells).toHaveLength(42);
    expect(grid.weeks).toBe(6);
  });

  it("weekStartsOn = 0（周日首列）时补位跟着变", () => {
    const grid = buildHeatmapMonth({ year: 2026, month: 8, weekStartsOn: 0 });
    expect(grid.cells.slice(0, 2).map((c) => c?.day ?? null)).toEqual([null, null]);
    expect(grid.cells[2]?.key).toBe("2026-09-01");
    expect(grid.cells).toHaveLength(35);
  });

  it("按 values 着色，缺省上界取本月最大值", () => {
    const grid = buildHeatmapMonth({
      year: 2026,
      month: 8,
      values: { "2026-09-01": 5, "2026-09-02": 0, "2026-09-03": 10 },
    });
    expect(grid.max).toBe(10);
    const byKey = new Map(grid.cells.filter((c) => c !== null).map((c) => [c!.key, c!]));
    expect(byKey.get("2026-09-01")?.level).toBe(2);
    expect(byKey.get("2026-09-02")?.level).toBe(0);
    expect(byKey.get("2026-09-03")?.level).toBe(4);
    expect(byKey.has("2026-10-01")).toBe(false);
  });

  it("显式 max 可锁住跨月对比，非法年月返回空网格", () => {
    const grid = buildHeatmapMonth({ year: 2026, month: 8, values: { "2026-09-01": 5 }, max: 20 });
    expect(grid.cells[1]?.level).toBe(1);
    expect(grid.max).toBe(5);
    expect(buildHeatmapMonth({ year: 2026, month: 12 })).toEqual({ cells: [], weeks: 0, max: 0 });
    expect(buildHeatmapMonth({ year: Number.NaN, month: 3 })).toEqual({ cells: [], weeks: 0, max: 0 });
  });
});

describe("mapSeriesPoints", () => {
  it("把值映射进带内边距的绘图区（最大值在顶、0 在底）", () => {
    const points = mapSeriesPoints([0, 5, 10], {
      width: 100,
      height: 50,
      padding: { top: 5, bottom: 5, left: 10, right: 10 },
    });
    expect(points.map((p) => p.x)).toEqual([10, 50, 90]);
    expect(points[0].y).toBeCloseTo(45, 6);
    expect(points[1].y).toBeCloseTo(25, 6);
    expect(points[2].y).toBeCloseTo(5, 6);
    expect(points.map((p) => p.ratio)).toEqual([0, 0.5, 1]);
    expect(points.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it("单点放水平中央，domain 可覆盖上界", () => {
    const lone = mapSeriesPoints([5], { width: 100, height: 50 });
    expect(lone[0].x).toBe(50);
    expect(lone[0].ratio).toBe(1);
    const half = mapSeriesPoints([5], { width: 100, height: 50 }, { min: 0, max: 10 });
    expect(half[0].ratio).toBe(0.5);
    expect(half[0].y).toBeCloseTo(25, 6);
  });

  it("空数组返回空点集，脏数据按 0 处理", () => {
    expect(mapSeriesPoints([], { width: 100, height: 50 })).toEqual([]);
    const points = mapSeriesPoints([Number.NaN, 4], { width: 100, height: 50 });
    expect(points[0].value).toBe(0);
    expect(points[0].ratio).toBe(0);
    expect(points[1].ratio).toBe(1);
  });
});

describe("linePath / areaPath", () => {
  it("直线段路径逐点 M/L", () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 10, y: 0 }])).toBe("M 0 10 L 10 0");
    expect(linePath([{ x: 1.234, y: 5.678 }])).toBe("M 1.23 5.68");
    expect(linePath([])).toBe("");
  });

  it("平滑模式输出三次贝塞尔（节点仍是采样点）", () => {
    const curved = linePath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 6 }], true);
    expect(curved.startsWith("M 0 10 C")).toBe(true);
    expect(curved).toContain("C");
    expect(curved.endsWith("20 6")).toBe(true);
  });

  it("面积路径闭合到基线", () => {
    expect(areaPath([{ x: 0, y: 10 }, { x: 10, y: 0 }], 10)).toBe("M 0 10 L 10 0 L 10 10 L 0 10 Z");
    // 少于两个点没有面积
    expect(areaPath([{ x: 0, y: 10 }], 10)).toBe("");
    expect(areaPath([], 10)).toBe("");
    expect(areaPath([{ x: 0, y: 10 }, { x: 10, y: 0 }], 10, true)).toContain("C");
  });
});

describe("雷达", () => {
  it("轴角度从 12 点钟顺时针均分", () => {
    expect(radarAxisAngles(4)).toEqual([-90, 0, 90, 180]);
    expect(radarAxisAngles(6)).toEqual([-90, -30, 30, 90, 150, 210]);
    expect(radarAxisAngles(0)).toEqual([-90]);
  });

  it("顶点按 0..1 完成度收缩，夹住越界值", () => {
    expect(polygonPoints(radarPoints([1, 1, 1, 1], 50, 50, 40))).toBe("50,10 90,50 50,90 10,50");
    const half = radarPoints([0.5, 0, 0, 0], 50, 50, 40);
    expect(half[0].y).toBeCloseTo(30, 6);
    expect(half[1].x).toBeCloseTo(50, 6);
    expect(half[1].y).toBeCloseTo(50, 6);
    expect(radarPoints([2, -1, 0, 0], 50, 50, 40)[0].y).toBeCloseTo(10, 6);
  });

  it("空维度退化成中心一点，polygonPoints 空数组返回空串", () => {
    const dot = radarPoints([], 50, 50, 40);
    expect(dot).toHaveLength(1);
    expect(dot[0].x).toBeCloseTo(50, 6);
    expect(polygonPoints([])).toBe("");
    expect(polygonPoints([{ x: 1.234, y: 5.678 }])).toBe("1.23,5.68");
  });

  it("标签锚点按 cos 分量左右中", () => {
    expect(radarLabelAnchor(0)).toBe("start");
    expect(radarLabelAnchor(180)).toBe("end");
    expect(radarLabelAnchor(-90)).toBe("middle");
    expect(radarLabelAnchor(90)).toBe("middle");
  });
});

describe("文案口径", () => {
  it("deltaDirection 浮点误差算持平", () => {
    expect(deltaDirection(3)).toBe("up");
    expect(deltaDirection(-3)).toBe("down");
    expect(deltaDirection(0)).toBe("flat");
    expect(deltaDirection(1e-12)).toBe("flat");
    expect(deltaDirection(Number.NaN)).toBe("flat");
  });

  it("deltaTone 支持反向指标（降才是好）", () => {
    expect(deltaTone(5)).toBe("success");
    expect(deltaTone(-5)).toBe("danger");
    expect(deltaTone(0)).toBe("muted");
    expect(deltaTone(-5, true)).toBe("success");
    expect(deltaTone(5, true)).toBe("danger");
    expect(deltaTone(Number.NaN)).toBe("muted");
  });

  it("formatDelta 带符号、可换后缀与位数", () => {
    expect(formatDelta(12)).toBe("+12%");
    expect(formatDelta(-3.24, "%", 1)).toBe("-3.2%");
    expect(formatDelta(0)).toBe("0%");
    expect(formatDelta(Number.NaN)).toBe("—");
    expect(formatDelta(1200)).toBe("+1200%");
    expect(formatDelta(5, "/s")).toBe("+5/s");
  });

  it("formatPercent 四舍五入到位数", () => {
    expect(formatPercent(0.864)).toBe("86%");
    expect(formatPercent(0.864, 1)).toBe("86.4%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(-0.5)).toBe("-50%");
    expect(formatPercent(Number.NaN)).toBe("—");
  });

  it("formatMonthDayRange 生成周区间标注", () => {
    expect(formatMonthDayRange("2026-06-29", "2026-07-05")).toBe("6/29-7/5");
    expect(formatMonthDayRange("2026-06-01", "2026-06-07")).toBe("6/1-6/7");
    // 跨年也不带年份（头部空间只够 M/D）
    expect(formatMonthDayRange("2025-12-29", "2026-01-04")).toBe("12/29-1/4");
  });

  it("formatMonthDayRange 对非法输入返回空串（不抛）", () => {
    expect(formatMonthDayRange("", "2026-07-05")).toBe("");
    expect(formatMonthDayRange("2026/06/29", "2026-07-05")).toBe("");
    expect(formatMonthDayRange("2026-06-29", "bad")).toBe("");
  });
});
