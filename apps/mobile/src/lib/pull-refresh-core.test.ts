import { describe, it, expect } from "vitest";
import { buildRefreshControlProps, pullRefreshOffset, STICKY_HEADER_ROW } from "./pull-refresh-core";

const colors = { primary: "#2F74C0", surfaceStrong: "#FFFFFF" };

describe("pullRefreshOffset", () => {
  it("无吸顶栏时等于安全区顶部", () => {
    expect(pullRefreshOffset({ top: 47 })).toBe(47);
    expect(pullRefreshOffset({ top: 0 })).toBe(0);
  });
  it("容错：非法/负的 top 归零，不产生 NaN", () => {
    expect(pullRefreshOffset({ top: Number.NaN, stickyHeader: true })).toBe(0);
    expect(pullRefreshOffset({ top: -20 })).toBe(0);
    expect(pullRefreshOffset({ top: Number.POSITIVE_INFINITY, stickyHeader: true })).toBe(0);
  });
  it("吸顶行高度是 44（与 screen-header 的 stickyRow.height 一致）", () => {
    expect(STICKY_HEADER_ROW).toBe(44);
  });
});

/**
 * v1.43.9 回归护栏（df275f7 → v1.43.10 修复）。
 *
 * df275f7 把 ScreenHeaderStickyBar 从「绝对定位悬浮」改成「普通文档流」：
 *   apps/mobile/src/components/screen-header.tsx:165  paddingTop: insets.top
 *   apps/mobile/src/components/screen-header.tsx:213  position: "relative"
 *   apps/mobile/src/components/screen-header.tsx:232  stickyRow.height = STICKY_HEADER_ROW(44)
 * 顶栏因此**占据** insets.top + 44 的文档流高度，滚动容器原点随之下移；
 * 而 progressViewOffset 是相对滚动容器计量的（Android ReactSwipeRefreshLayout.kt:42-53 /
 * iOS RCTRefreshControl.m:140-158）→ 再追加 44 即双重计算，转圈被额外下推 44pt。
 */
describe("v1.43.9 回归：顶栏进入文档流后不得再叠加 STICKY_HEADER_ROW", () => {
  it("stickyHeader:true 的偏移与无顶栏页面一致（都只等于安全区顶部）", () => {
    expect(pullRefreshOffset({ top: 47, stickyHeader: true })).toBe(47);
    expect(pullRefreshOffset({ top: 47, stickyHeader: true })).toBe(pullRefreshOffset({ top: 47 }));
    expect(pullRefreshOffset({ top: 47, stickyHeader: true })).not.toBe(47 + STICKY_HEADER_ROW);
  });
  it("stickyHeader 显式 false 与不传，行为完全一致（保持无顶栏页面不变）", () => {
    for (const top of [0, 20, 24, 47, 59]) {
      expect(pullRefreshOffset({ top, stickyHeader: false })).toBe(top);
      expect(pullRefreshOffset({ top })).toBe(top);
    }
  });
});

describe("buildRefreshControlProps", () => {
  it("主题色口径统一：tintColor/colors 走主色，背景走 surfaceStrong", () => {
    const p = buildRefreshControlProps(colors, { refreshing: false, onRefresh: () => {}, top: 24, stickyHeader: true });
    expect(p.tintColor).toBe(colors.primary);
    expect(p.colors).toEqual([colors.primary]);
    expect(p.progressBackgroundColor).toBe(colors.surfaceStrong);
    // v1.43.9 回归修复前是 24 + 44 = 68
    expect(p.progressViewOffset).toBe(24);
  });
  it("透传 refreshing 与 onRefresh 引用", () => {
    const fn = () => {};
    const p = buildRefreshControlProps(colors, { refreshing: true, onRefresh: fn, top: 10 });
    expect(p.refreshing).toBe(true);
    expect(p.onRefresh).toBe(fn);
    expect(p.progressViewOffset).toBe(10);
  });
});
