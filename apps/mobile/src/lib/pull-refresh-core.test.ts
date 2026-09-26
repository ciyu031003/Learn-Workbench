import { describe, it, expect } from "vitest";
import { buildRefreshControlProps, pullRefreshOffset, STICKY_HEADER_ROW } from "./pull-refresh-core";

const colors = { primary: "#2F74C0", surfaceStrong: "#FFFFFF" };

describe("pullRefreshOffset", () => {
  it("无吸顶栏时等于安全区顶部", () => {
    expect(pullRefreshOffset({ top: 47 })).toBe(47);
    expect(pullRefreshOffset({ top: 0 })).toBe(0);
  });
  it("有吸顶栏时加一个状态行高度（否则转圈被吸顶栏盖住）", () => {
    expect(pullRefreshOffset({ top: 47, stickyHeader: true })).toBe(47 + STICKY_HEADER_ROW);
  });
  it("容错：非法/负的 top 归零，不产生 NaN", () => {
    expect(pullRefreshOffset({ top: Number.NaN, stickyHeader: true })).toBe(STICKY_HEADER_ROW);
    expect(pullRefreshOffset({ top: -20 })).toBe(0);
  });
  it("吸顶行高度是 44（与 screen-header 的吸顶栏一致）", () => {
    expect(STICKY_HEADER_ROW).toBe(44);
  });
});

describe("buildRefreshControlProps", () => {
  it("主题色口径统一：tintColor/colors 走主色，背景走 surfaceStrong", () => {
    const p = buildRefreshControlProps(colors, { refreshing: false, onRefresh: () => {}, top: 24, stickyHeader: true });
    expect(p.tintColor).toBe(colors.primary);
    expect(p.colors).toEqual([colors.primary]);
    expect(p.progressBackgroundColor).toBe(colors.surfaceStrong);
    expect(p.progressViewOffset).toBe(24 + STICKY_HEADER_ROW);
  });
  it("透传 refreshing 与 onRefresh 引用", () => {
    const fn = () => {};
    const p = buildRefreshControlProps(colors, { refreshing: true, onRefresh: fn, top: 10 });
    expect(p.refreshing).toBe(true);
    expect(p.onRefresh).toBe(fn);
    expect(p.progressViewOffset).toBe(10);
  });
});
