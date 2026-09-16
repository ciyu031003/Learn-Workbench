import { describe, expect, it } from "vitest";
import { EDGE_SWIPE_DEFAULT, resolveEdgeSwipeEnabled } from "./edge-swipe";

/**
 * 边缘横滑开关的解析规则（OPPO/ColorOS 触摸失效专项）：
 * 用户显式设置优先；未设置时 iOS 默认开、Android 默认关。
 * 这条规则保证「Android 全品牌一致」——不存在任何按厂商分支的行为。
 */
describe("resolveEdgeSwipeEnabled", () => {
  it("用户显式开启后，任何平台都生效", () => {
    expect(resolveEdgeSwipeEnabled(true, "ios")).toBe(true);
    expect(resolveEdgeSwipeEnabled(true, "android")).toBe(true);
    expect(resolveEdgeSwipeEnabled(true, "web")).toBe(true);
  });

  it("用户显式关闭后，任何平台都不生效", () => {
    expect(resolveEdgeSwipeEnabled(false, "ios")).toBe(false);
    expect(resolveEdgeSwipeEnabled(false, "android")).toBe(false);
  });

  it("未设置时：iOS 默认开", () => {
    expect(resolveEdgeSwipeEnabled(null, "ios")).toBe(true);
    expect(resolveEdgeSwipeEnabled(undefined, "ios")).toBe(true);
  });

  it("未设置时：Android 默认关（避免与系统返回手势抢触摸）", () => {
    expect(resolveEdgeSwipeEnabled(null, "android")).toBe(false);
    expect(resolveEdgeSwipeEnabled(undefined, "android")).toBe(false);
  });

  it("未知平台回落到安全默认（关）", () => {
    expect(resolveEdgeSwipeEnabled(null, "windows")).toBe(EDGE_SWIPE_DEFAULT);
    expect(resolveEdgeSwipeEnabled(null, "web")).toBe(false);
  });
});
