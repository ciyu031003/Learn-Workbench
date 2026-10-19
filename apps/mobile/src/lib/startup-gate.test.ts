import { describe, it, expect, beforeEach } from "vitest";
import {
  LOW_END_MEMORY_THRESHOLD_BYTES,
  STARTUP_HARD_TIMEOUT_MS,
  __resetDeviceTierForTests,
  classifyDeviceTier,
  describeStartupDecision,
  evaluateStartupGate,
  getDeviceTier,
  isDeviceTierResolved,
  isLowEndDevice,
  normalizeDeviceTier,
  setDeviceTier,
} from "./startup-gate";

beforeEach(() => {
  __resetDeviceTierForTests();
});

describe("设备分档", () => {
  it("内存 <3GB 判低端，>=3GB/未知判高端", () => {
    expect(classifyDeviceTier({ totalMemoryBytes: 2 * 1024 ** 3 })).toBe("low");
    expect(classifyDeviceTier({ totalMemoryBytes: LOW_END_MEMORY_THRESHOLD_BYTES - 1 })).toBe("low");
    expect(classifyDeviceTier({ totalMemoryBytes: LOW_END_MEMORY_THRESHOLD_BYTES })).toBe("high");
    expect(classifyDeviceTier({ totalMemoryBytes: 8 * 1024 ** 3 })).toBe("high");
    expect(classifyDeviceTier({ totalMemoryBytes: null })).toBe("high");
    expect(classifyDeviceTier({})).toBe("high");
  });

  it("EXPO_PUBLIC_FORCE_DEVICE_TIER 可强制（低端/高端/非法）", () => {
    expect(classifyDeviceTier({ forcedTier: "low", totalMemoryBytes: 8 * 1024 ** 3 })).toBe("low");
    expect(classifyDeviceTier({ forcedTier: "high", totalMemoryBytes: 1 * 1024 ** 3 })).toBe("high");
    expect(classifyDeviceTier({ forcedTier: "LOW-END" })).toBe("low");
    expect(classifyDeviceTier({ forcedTier: "nonsense" })).toBe("high");
    expect(normalizeDeviceTier("lowend")).toBe("low");
    expect(normalizeDeviceTier("HIGH")).toBe("high");
    expect(normalizeDeviceTier(undefined)).toBeNull();
  });

  it("运行时档位默认 high，setDeviceTier 后 isLowEndDevice 生效", () => {
    expect(isDeviceTierResolved()).toBe(false);
    expect(getDeviceTier()).toBe("high");
    expect(isLowEndDevice()).toBe(false);
    setDeviceTier("low");
    expect(isDeviceTierResolved()).toBe(true);
    expect(isLowEndDevice()).toBe(true);
  });
});

describe("hydration gate（启动水位）", () => {
  const startedAt = 1_000_000;

  it("未恢复/未首帧 → waiting，并给出剩余兜底时间", () => {
    const decision = evaluateStartupGate({ startedAt, now: startedAt + 120, hasHydrated: false, firstFramePainted: true });
    expect(decision.state).toBe("waiting");
    expect(decision.waitedMs).toBe(120);
    expect(decision.remainingMs).toBe(STARTUP_HARD_TIMEOUT_MS - 120);
    expect(decision.reason).toBeNull();
  });

  it("恢复完成 + 首帧完成 → ready（正常放行）", () => {
    const decision = evaluateStartupGate({ startedAt, now: startedAt + 180, hasHydrated: true, firstFramePainted: true });
    expect(decision.state).toBe("ready");
    expect(decision.reason).toBe("hydrated-and-painted");
    expect(decision.waitedMs).toBe(180);
  });

  it("只满足一个条件不算 ready（深色不白闪的关键：必须等 hydration）", () => {
    expect(
      evaluateStartupGate({ startedAt, now: startedAt + 180, hasHydrated: true, firstFramePainted: false }).state
    ).toBe("waiting");
    expect(
      evaluateStartupGate({ startedAt, now: startedAt + 180, hasHydrated: false, firstFramePainted: true }).state
    ).toBe("waiting");
  });

  it("超过兜底超时 → timeout（持久化卡死也不能永远白屏）", () => {
    const decision = evaluateStartupGate({
      startedAt,
      now: startedAt + STARTUP_HARD_TIMEOUT_MS,
      hasHydrated: false,
      firstFramePainted: true,
    });
    expect(decision.state).toBe("timeout");
    expect(decision.reason).toBe("hard-timeout");
    expect(decision.remainingMs).toBe(0);
  });

  it("自定义 hardTimeoutMs 生效；负等待时间被钳到 0", () => {
    const decision = evaluateStartupGate({
      startedAt: startedAt + 500,
      now: startedAt,
      hasHydrated: false,
      firstFramePainted: false,
      hardTimeoutMs: 5000,
    });
    expect(decision.waitedMs).toBe(0);
    expect(decision.remainingMs).toBe(5000);
  });

  it("describeStartupDecision 产出可写面包屑的摘要", () => {
    const decision = evaluateStartupGate({ startedAt, now: startedAt + 250, hasHydrated: true, firstFramePainted: true });
    const text = describeStartupDecision({ decision, tier: "low", hasHydrated: true, firstFramePainted: true });
    expect(text).toContain("tier=low");
    expect(text).toContain("coldStartMs=250");
    expect(text).toContain("state=ready");
    expect(text).toContain("hydrated=true");
  });
});
