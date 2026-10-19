import { describe, expect, it } from "vitest";
import {
  LOW_END_MAX_CORES,
  LOW_END_MAX_MEMORY_GB,
  readDeviceHints,
  shouldDegrade3d,
} from "./device-capability";

describe("shouldDegrade3d", () => {
  it("高配设备保持 3D", () => {
    expect(shouldDegrade3d({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
    expect(shouldDegrade3d({ hardwareConcurrency: 12, deviceMemory: 16, saveData: false })).toBe(false);
  });

  it("省流量模式直接降级", () => {
    expect(shouldDegrade3d({ saveData: true, hardwareConcurrency: 16, deviceMemory: 16 })).toBe(true);
  });

  it("低核心数降级（含边界）", () => {
    expect(shouldDegrade3d({ hardwareConcurrency: LOW_END_MAX_CORES })).toBe(true);
    expect(shouldDegrade3d({ hardwareConcurrency: 3 })).toBe(true);
    expect(shouldDegrade3d({ hardwareConcurrency: LOW_END_MAX_CORES + 1 })).toBe(false);
  });

  it("低内存降级（含边界）", () => {
    expect(shouldDegrade3d({ deviceMemory: LOW_END_MAX_MEMORY_GB })).toBe(true);
    expect(shouldDegrade3d({ deviceMemory: LOW_END_MAX_MEMORY_GB + 2 })).toBe(false);
  });

  it("字段缺失/非法值不误伤", () => {
    expect(shouldDegrade3d()).toBe(false);
    expect(shouldDegrade3d({})).toBe(false);
    expect(shouldDegrade3d({ hardwareConcurrency: 0, deviceMemory: 0 })).toBe(false);
    expect(shouldDegrade3d({ hardwareConcurrency: Number.NaN })).toBe(false);
  });
});

describe("readDeviceHints", () => {
  it("SSR/无 source 返回空对象", () => {
    expect(readDeviceHints()).toEqual({});
  });

  it("只摘取已知字段", () => {
    expect(
      readDeviceHints({ hardwareConcurrency: 8, deviceMemory: 4, connection: { saveData: true } })
    ).toEqual({ hardwareConcurrency: 8, deviceMemory: 4, saveData: true });
  });

  it("忽略非数字/非布尔的脏值", () => {
    expect(readDeviceHints({ hardwareConcurrency: undefined, deviceMemory: undefined })).toEqual({});
    expect(readDeviceHints({ connection: {} })).toEqual({});
  });
});
