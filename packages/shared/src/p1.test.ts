import { describe, it, expect } from "vitest";
import { jobFreshness, normalizeJobText, jobDedupKey } from "./index";

describe("jobFreshness (P1)", () => {
  it("marks <1d as just published for job channel", () => {
    const f = jobFreshness(new Date(Date.now() - 2 * 3600000).toISOString(), new Date().toISOString(), null, "job");
    expect(f.level).toBe("just");
    expect(f.label).toBe("刚发布");
  });

  it("marks 3-7d as within7", () => {
    const f = jobFreshness(new Date(Date.now() - 5 * 86400000).toISOString(), new Date().toISOString(), null, "job");
    expect(f.level).toBe("within7");
  });

  it("marks >30d as stale", () => {
    const f = jobFreshness(new Date(Date.now() - 40 * 86400000).toISOString(), new Date().toISOString(), null, "job");
    expect(f.level).toBe("stale");
    expect(f.label).toBe("可能已失效");
  });

  it("uses fetchedAt when publishedAt missing", () => {
    const f = jobFreshness(null, new Date(Date.now() - 2 * 86400000).toISOString(), null, "job");
    expect(f.level).toBe("within3");
  });

  it("uses deadline countdown for announcement channel", () => {
    const f = jobFreshness(null, new Date().toISOString(), new Date(Date.now() + 2 * 86400000).toISOString(), "announcement");
    expect(f.level).toBe("deadline");
    expect(f.label).toContain("天后截止");
  });
});

describe("normalizeJobText / jobDedupKey (P1)", () => {
  it("normalizes case, whitespace and suffixes", () => {
    expect(normalizeJobText("Python 后端工程师（深圳）")).toBe("python后端工程师");
    expect(normalizeJobText("腾讯科技有限公司")).toBe("腾讯");
    expect(normalizeJobText("  ABC 科技  ")).toBe("abc");
  });

  it("produces stable dedup keys ignoring company suffixes", () => {
    const a = jobDedupKey("Python 后端工程师", "星辰科技有限公司", "深圳");
    const b = jobDedupKey("Python后端工程师", "星辰科技", "深圳");
    expect(a).toBe(b);
  });
});
