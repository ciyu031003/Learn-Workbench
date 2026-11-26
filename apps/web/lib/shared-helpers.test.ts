import { describe, it, expect } from "vitest";
import {
  todayISO,
  formatDateCN,
  formatDuration,
  pct,
  clamp,
  roadmapSchema,
} from "@learn-workbench/shared";
import { todayISOInZone } from "@learn-workbench/shared/domains";

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

describe("shared helpers", () => {
  it("todayISO formats the local date and supports day offsets", () => {
    const now = new Date();
    expect(todayISO()).toBe(isoOf(now));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(todayISO(1)).toBe(isoOf(tomorrow));
  });

  it("todayISOInZone keeps the business day on Asia/Shanghai across the UTC midnight", () => {
    // 2026-11-26T17:27Z = 2026-11-27 01:27 CST：接口默认日期必须落到 27 号，
    // 否则 00:00–08:00 写入的饮水/训练/任务会被算到前一天（S5-1 决策 D3）。
    expect(todayISOInZone("Asia/Shanghai", "2026-11-26T17:27:06Z")).toBe("2026-11-27");
    expect(todayISOInZone("Asia/Shanghai", "2026-11-26T15:59:59Z")).toBe("2026-11-26");
  });

  it("formatDateCN renders Chinese date", () => {
    expect(formatDateCN("2026-08-13")).toBe("2026 年 8 月 13 日");
    expect(formatDateCN("2026-12-03")).toBe("2026 年 12 月 3 日");
  });

  it("formatDuration renders minutes/hours", () => {
    expect(formatDuration(0)).toBe("0 分钟");
    expect(formatDuration(25)).toBe("25 分钟");
    expect(formatDuration(60)).toBe("1 小时 0 分");
    expect(formatDuration(95)).toBe("1 小时 35 分");
  });

  it("pct rounds to an integer and guards total <= 0", () => {
    expect(pct(3, 10)).toBe(30);
    expect(pct(1, 3)).toBe(33);
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });

  it("clamp bounds a value", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("roadmapSchema parses a valid roadmap", () => {
    const res = roadmapSchema.safeParse({ phases: [] });
    expect(res.success).toBe(true);
  });
});
