import { describe, it, expect } from "vitest";
import {
  todayISO,
  formatDateCN,
  formatDuration,
  pct,
  clamp,
  roadmapSchema,
} from "@learn-workbench/shared";

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
