import { describe, it, expect } from "vitest";
import { aggregateTimeSeries, labelPositions, parsePointMs, MAX_BARS } from "./market-series";

function daily(days: number, base: string, value = 1) {
  const out: { date: string; newJobs: number }[] = [];
  const start = Date.parse(base + "T00:00:00Z");
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * 86400000);
    out.push({ date: d.toISOString().slice(0, 10), newJobs: value });
  }
  return out;
}

function hourly(hours: number, base: string, value = 2) {
  const out: { date: string; newJobs: number }[] = [];
  const start = Date.parse(base);
  for (let i = 0; i < hours; i++) {
    const d = new Date(start + i * 3600000);
    out.push({ date: d.toISOString().slice(0, 16), newJobs: value });
  }
  return out;
}

describe("aggregateTimeSeries", () => {
  it("空序列返回空", () => {
    const r = aggregateTimeSeries([]);
    expect(r.buckets).toHaveLength(0);
    expect(r.rawCount).toBe(0);
  });

  it("小时级 24 点 → 3 小时一档（用户点名的范例），柱数不超过上限", () => {
    const r = aggregateTimeSeries(hourly(24, "2026-09-29T00:00:00Z"));
    expect(r.aggregated).toBe(true);
    expect(r.intervalLabel).toBe("每 3 小时");
    expect(r.buckets.length).toBeLessThanOrEqual(MAX_BARS);
    // 每档 3 个点 × 2 = 6
    expect(r.buckets.slice(0, 3).map((b) => b.value)).toEqual([6, 6, 6]);
    expect(r.buckets[0].label).toBe("00:00");
  });

  it("日级 30 点 → 每 3 天，且合计等于原始总和（不丢数据）", () => {
    const src = daily(30, "2026-09-01", 3);
    const r = aggregateTimeSeries(src);
    expect(r.aggregated).toBe(true);
    expect(r.intervalLabel).toBe("每 3 天");
    expect(r.buckets.length).toBeLessThanOrEqual(MAX_BARS);
    expect(r.buckets.reduce((a, b) => a + b.value, 0)).toBe(90);
    expect(r.buckets[0].label).toMatch(/^[0-9]{2}-[0-9]{2}$/);
  });

  it("点数本来就少则不聚合（保持原始粒度）", () => {
    const r = aggregateTimeSeries(daily(7, "2026-09-01", 5));
    expect(r.aggregated).toBe(false);
    expect(r.intervalLabel).toBe("原始粒度");
    expect(r.buckets).toHaveLength(7);
    expect(r.buckets[6].value).toBe(5);
  });

  it("中间缺失的时间会补 0 桶（保留真实分布，不跳着画）", () => {
    const src = [
      { date: "2026-09-01", newJobs: 2 },
      { date: "2026-09-10", newJobs: 4 },
    ];
    const r = aggregateTimeSeries(src);
    expect(r.buckets.length).toBeGreaterThan(2);
    expect(r.buckets.filter((b) => b.value === 0).length).toBeGreaterThan(0);
    expect(r.buckets.reduce((a, b) => a + b.value, 0)).toBe(6);
  });

  it("日期无法解析时退回索引抽样，且不超上限", () => {
    const src = Array.from({ length: 40 }, (_, i) => ({ date: "bad-" + i, newJobs: 1 }));
    const r = aggregateTimeSeries(src);
    expect(r.aggregated).toBe(true);
    expect(r.buckets.length).toBeLessThanOrEqual(MAX_BARS + 1);
    expect(r.intervalLabel).toBe("等距抽样");
  });

  it("单点不崩", () => {
    const r = aggregateTimeSeries([{ date: "2026-09-01", newJobs: 7 }]);
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].value).toBe(7);
    expect(r.aggregated).toBe(false);
  });
});

describe("parsePointMs", () => {
  it("纯日期按 UTC 解析（不会因时区整体挪一天）", () => {
    expect(parsePointMs("2026-09-01")).toBe(Date.UTC(2026, 8, 1));
  });
  it("ISO 时间串可解析，非法返回 null", () => {
    expect(parsePointMs("2026-09-01T13:00:00Z")).toBe(Date.UTC(2026, 8, 1, 13));
    expect(parsePointMs("nope")).toBeNull();
  });
});

describe("labelPositions", () => {
  it("柱数少时全部显示", () => {
    expect([...labelPositions(4, 5)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
  it("柱数多时只留首尾与均匀采样位", () => {
    const pos = [...labelPositions(12, 5)].sort((a, b) => a - b);
    expect(pos[0]).toBe(0);
    expect(pos[pos.length - 1]).toBe(11);
    expect(pos.length).toBeLessThanOrEqual(6);
  });
});
