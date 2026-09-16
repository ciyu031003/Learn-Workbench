import { describe, expect, it } from "vitest";
import { formatDiagnostics, judgeTouch, type DiagnosticsInput } from "./diagnostics";

const base: DiagnosticsInput = {
  appVersion: "1.3.4",
  platform: "android",
  osVersion: 36,
  brand: "OPPO",
  manufacturer: "OPPO",
  model: "PJZ110",
  release: "16",
  uiMode: "normal",
  window: { width: 1080, height: 2400, scale: 3, fontScale: 1 },
  screen: { width: 1080, height: 2400 },
  insets: { top: 88, bottom: 48, left: 0, right: 0 },
  heartbeatTicks: 12,
  uptimeMs: 12_300,
  firstTouchMs: 3_200,
  tapCount: 7,
  lastTap: { x: 540, y: 1200 },
  edgeSwipeEnabled: false,
  tokenLoaded: null,
  pendingSync: 0,
};

describe("judgeTouch", () => {
  it("收到触摸 → ok（触摸链路正常，问题应在 UI 覆盖层）", () => {
    const v = judgeTouch({ tapCount: 1, heartbeatTicks: 5 });
    expect(v.level).toBe("ok");
    expect(v.detail).toContain("覆盖层");
  });

  it("没收到触摸 → warn（触摸在到达 App 前被拦截）", () => {
    const v = judgeTouch({ tapCount: 0, heartbeatTicks: 5 });
    expect(v.level).toBe("warn");
    expect(v.detail).toContain("拦截");
  });

  it("心跳没起来 → pending（JS 线程被卡住）", () => {
    const v = judgeTouch({ tapCount: 0, heartbeatTicks: 0 });
    expect(v.level).toBe("pending");
    expect(v.detail).toContain("JS 线程");
  });
});

describe("formatDiagnostics", () => {
  const text = formatDiagnostics(base, new Date("2026-09-15T12:00:00.000Z"));

  it("带上版本号与生成时间", () => {
    expect(text).toContain("苦旅 v1.3.4 触控自检报告");
    expect(text).toContain("2026-09-15T12:00:00.000Z");
  });

  it("包含判断 ROM 问题所需的设备与显示信息", () => {
    expect(text).toContain("OPPO / OPPO");
    expect(text).toContain("PJZ110");
    expect(text).toContain("android 36");
    expect(text).toContain("insets：top 88 / bottom 48 / left 0 / right 0");
    expect(text).toContain("fontScale 1");
  });

  it("包含运行时判据（心跳 / 首个触摸 / 触摸计数 / 落点）", () => {
    expect(text).toContain("JS 心跳：12 次（已运行 12.3s）");
    expect(text).toContain("首个触摸：3.2s");
    expect(text).toContain("触摸计数：7 次，最后落点 (540, 1200)");
  });

  it("令牌读取超时要显式写出（排查 ColorOS Keystore 卡顿）", () => {
    expect(text).toContain("登录令牌：读取超时/失败（按未登录启动）");
  });

  it("字段缺失时不崩，用 ? 占位", () => {
    const partial: DiagnosticsInput = {
      ...base,
      brand: undefined,
      manufacturer: undefined,
      model: undefined,
      release: undefined,
      uiMode: undefined,
      firstTouchMs: null,
      lastTap: null,
      tapCount: 0,
    };
    const t = formatDiagnostics(partial);
    expect(t).toContain("厂商 / 品牌：? / ?");
    expect(t).toContain("首个触摸：尚未收到");
    expect(t).toContain("触摸计数：0 次");
    expect(t).not.toContain("最后落点");
    expect(t).toContain("⚠️");
  });

  it("心跳为 0 时结论是 pending（⏳）", () => {
    const t = formatDiagnostics({ ...base, heartbeatTicks: 0 });
    expect(t).toContain("⏳");
  });
});
