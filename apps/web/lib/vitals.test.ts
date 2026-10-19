import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_VITAL_SAMPLE_RATE,
  rateVital,
  recordVital,
  renderVitalsMetrics,
  resetVitals,
  resolveMotionTier,
  sanitizeRoute,
  shouldSampleVitals,
  vitalsSnapshot,
  parseWebVitalSample,
} from "./vitals";

const sample = (overrides: Partial<Parameters<typeof recordVital>[0]> = {}) => ({
  name: "LCP" as const,
  value: 1800,
  rating: "good" as const,
  route: "/dashboard",
  ...overrides,
});

beforeEach(() => resetVitals());

describe("rateVital", () => {
  it("按 Core Web Vitals 阈值分级", () => {
    expect(rateVital("LCP", 2500)).toBe("good");
    expect(rateVital("LCP", 2501)).toBe("needs-improvement");
    expect(rateVital("LCP", 4000)).toBe("needs-improvement");
    expect(rateVital("LCP", 4001)).toBe("poor");
    expect(rateVital("CLS", 0.1)).toBe("good");
    expect(rateVital("CLS", 0.2)).toBe("needs-improvement");
    expect(rateVital("CLS", 0.3)).toBe("poor");
    expect(rateVital("INP", 200)).toBe("good");
    expect(rateVital("INP", 501)).toBe("poor");
  });

  it("非法数值按 good 处理（不污染指标）", () => {
    expect(rateVital("LCP", Number.NaN)).toBe("good");
  });
});

describe("shouldSampleVitals", () => {
  it("省流量 / 2G 直接跳过", () => {
    expect(shouldSampleVitals({ saveData: true, random: 0 })).toBe(false);
    expect(shouldSampleVitals({ effectiveType: "2g", random: 0 })).toBe(false);
    expect(shouldSampleVitals({ effectiveType: "slow-2g", random: 0 })).toBe(false);
    expect(shouldSampleVitals({ effectiveType: "4g", random: 0 })).toBe(true);
  });

  it("默认 20% 采样率，低端机降到 1/3", () => {
    expect(shouldSampleVitals({ random: 0.19, sampleRate: DEFAULT_VITAL_SAMPLE_RATE })).toBe(true);
    expect(shouldSampleVitals({ random: 0.21, sampleRate: DEFAULT_VITAL_SAMPLE_RATE })).toBe(false);
    // 4 核低端机：0.2/3 ≈ 0.0667
    expect(shouldSampleVitals({ hardwareConcurrency: 4, random: 0.06 })).toBe(true);
    expect(shouldSampleVitals({ hardwareConcurrency: 4, random: 0.07 })).toBe(false);
    expect(shouldSampleVitals({ hardwareConcurrency: 8, random: 0.07 })).toBe(true);
  });
});

describe("sanitizeRoute", () => {
  it("去掉 query/hash", () => {
    expect(sanitizeRoute("/tasks?date=2026-08-13#focus")).toBe("/tasks");
    expect(sanitizeRoute("/logs?q=secret")).toBe("/logs");
  });

  it("uuid / hex / 数字段脱敏为 :id", () => {
    expect(sanitizeRoute("/career/resume/123e4567-e89b-12d3-a456-426614174000")).toBe("/career/resume/:id");
    expect(sanitizeRoute("/jobs/42")).toBe("/jobs/:id");
    expect(sanitizeRoute("/content-images/2009-44-1-label.png")).toContain(":id");
  });

  it("空值与超长路径安全", () => {
    expect(sanitizeRoute("")).toBe("/");
    expect(sanitizeRoute("/" + "z".repeat(200)).length).toBe(80);
  });
});

describe("resolveMotionTier", () => {
  it("系统 reduced-motion → reduced", () => {
    expect(resolveMotionTier({ prefersReducedMotion: true })).toBe("reduced");
    expect(resolveMotionTier({ prefersReducedMotion: true, saveData: false, hardwareConcurrency: 16 })).toBe("reduced");
  });

  it("省流 / 极低端 → none", () => {
    expect(resolveMotionTier({ prefersReducedMotion: false, saveData: true })).toBe("none");
    expect(resolveMotionTier({ prefersReducedMotion: false, hardwareConcurrency: 2 })).toBe("none");
    expect(resolveMotionTier({ prefersReducedMotion: false, deviceMemory: 1 })).toBe("none");
  });

  it("低端（4 核 / 2GB）→ reduced，其余 full", () => {
    expect(resolveMotionTier({ prefersReducedMotion: false, hardwareConcurrency: 4 })).toBe("reduced");
    expect(resolveMotionTier({ prefersReducedMotion: false, deviceMemory: 2 })).toBe("reduced");
    expect(resolveMotionTier({ prefersReducedMotion: false, hardwareConcurrency: 8, deviceMemory: 8 })).toBe("full");
    expect(resolveMotionTier({ prefersReducedMotion: false })).toBe("full");
  });
});

describe("聚合注册表与 Prometheus 输出", () => {
  it("只做聚合（count/avg/max/评级），不保留单条事件与路由明细", () => {
    recordVital(sample({ value: 1000, rating: "good" }));
    recordVital(sample({ value: 3000, rating: "needs-improvement", route: "/career/resume/:id" }));
    recordVital(sample({ name: "CLS", value: 0.2, rating: "needs-improvement" }));

    const snap = vitalsSnapshot();
    const lcp = snap.find((s) => s.name === "LCP")!;
    expect(lcp.count).toBe(2);
    expect(lcp.avg).toBe(2000);
    expect(lcp.max).toBe(3000);
    expect(lcp.ratings).toEqual({ good: 1, "needs-improvement": 1, poor: 0 });
    // 注册表里没有任何 route/用户字段
    expect(Object.keys(lcp).sort()).toEqual(["avg", "count", "max", "name", "ratings"]);
  });

  it("renderVitalsMetrics 输出合法 Prometheus 文本", () => {
    recordVital(sample({ value: 2000 }));
    const text = renderVitalsMetrics();
    expect(text).toContain("# TYPE lwb_web_vitals_samples_total counter");
    expect(text).toContain('lwb_web_vitals_samples_total{metric="LCP",rating="good"} 1');
    expect(text).toContain('lwb_web_vitals_value_avg{metric="LCP"} 2000');
    expect(text.endsWith("\n")).toBe(true);
    // 空注册表也要输出合法的 HELP/TYPE（抓取端不报错）
    resetVitals();
    expect(renderVitalsMetrics()).toContain("# HELP lwb_web_vitals_samples_total");
  });

  it("parseWebVitalSample 拒绝越界/伪造字段（手写校验与旧 zod 等价）", () => {
    expect(parseWebVitalSample({ name: "LCP", value: 1, rating: "good", route: "/" })).toMatchObject({ name: "LCP" });
    expect(parseWebVitalSample({ name: "NOPE", value: 1, rating: "good", route: "/" })).toBeNull();
    expect(parseWebVitalSample({ name: "LCP", value: Number.POSITIVE_INFINITY, rating: "good", route: "/" })).toBeNull();
    expect(parseWebVitalSample({ name: "LCP", value: 1, rating: "great", route: "/" })).toBeNull();
    expect(parseWebVitalSample({ name: "LCP", value: 1e9, rating: "poor", route: "/" })).toBeNull();
    expect(parseWebVitalSample({ name: "CLS", value: 0.1, rating: "good", route: "" })).toBeNull();
    expect(parseWebVitalSample({ name: "CLS", value: 0.1, rating: "good", route: "/x", navigationType: "n".repeat(25) })).toBeNull();
  });
});
