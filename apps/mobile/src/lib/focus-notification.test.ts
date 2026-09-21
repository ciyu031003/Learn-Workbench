import { describe, it, expect, vi, beforeEach } from "vitest";

const nativeStart = vi.fn();
const nativeStop = vi.fn();
let hasNative = true;

vi.mock("react-native", () => ({
  Platform: { OS: "android", Version: 34 },
  PermissionsAndroid: { request: vi.fn(async () => "granted"), PERMISSIONS: { POST_NOTIFICATIONS: "POST_NOTIFICATIONS" } },
  NativeModules: {
    get FocusTimer() {
      return hasNative ? { start: nativeStart, stop: nativeStop } : undefined;
    },
  },
}));

import { focusNotificationSupported, startFocusNotification, stopFocusNotification } from "./focus-notification";

beforeEach(() => {
  nativeStart.mockReset();
  nativeStop.mockReset();
  hasNative = true;
});

describe("focus-notification", () => {
  it("把「虚拟起点」交给原生：startAtMs = now - 已跑毫秒", async () => {
    const before = Date.now();
    await startFocusNotification({ title: "英语读写", mode: "countdown", totalMs: 1500000, elapsedMs: 60000 });
    expect(nativeStart).toHaveBeenCalledTimes(1);
    const call = nativeStart.mock.calls[0] as [string, string, number, number];
    expect(call[0]).toBe("英语读写");
    expect(call[1]).toBe("countdown");
    expect(call[2]).toBe(1500000);
    expect(call[3]).toBeGreaterThanOrEqual(before - 60000);
    expect(call[3]).toBeLessThanOrEqual(Date.now() - 60000 + 50);
  });

  it("负数 / 非法参数归零，不会算出未来起点", async () => {
    await startFocusNotification({ title: "x", mode: "stopwatch", totalMs: -5, elapsedMs: -1000 });
    const call = nativeStart.mock.calls[0] as [string, string, number, number];
    expect(call[2]).toBe(0);
    expect(call[3]).toBeLessThanOrEqual(Date.now());
  });

  it("原生模块缺失时全部静默 no-op", async () => {
    hasNative = false;
    expect(focusNotificationSupported()).toBe(false);
    await expect(startFocusNotification({ title: "x", mode: "countdown", totalMs: 1, elapsedMs: 0 })).resolves.toBeUndefined();
    expect(() => stopFocusNotification()).not.toThrow();
    expect(nativeStart).not.toHaveBeenCalled();
  });

  it("stop 会转发给原生", () => {
    stopFocusNotification();
    expect(nativeStop).toHaveBeenCalledTimes(1);
  });
});
