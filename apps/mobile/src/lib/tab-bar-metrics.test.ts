import { describe, it, expect } from "vitest";
import {
  tabBarSpaceFor,
  tabBarBottomFor,
  tabBarSpaceForRoute,
  showsTabBar,
  TAB_BAR_ROUTES,
  TAB_BAR_FLOAT_GAP,
  TAB_BAR_HEIGHT,
  TAB_BAR_BREATHING,
} from "./tab-bar-metrics";

/**
 * 回归护栏：2026-09-15「底栏遮挡内容」——11 个页面 paddingBottom=40 而
 * 浮动底栏占 78pt，最后一行被压住。留白必须 ≥ 底栏高 + 安全区 + 呼吸。
 */
describe("tabBarSpaceFor", () => {
  it("无安全区的设备也要让开悬浮胶囊本体与间距", () => {
    expect(tabBarSpaceFor(0)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING);
    expect(tabBarSpaceFor(0)).toBeGreaterThanOrEqual(56);
  });

  it("叠加底部安全区（手势条 / 虚拟导航栏）", () => {
    expect(tabBarSpaceFor(34)).toBe(56 + 6 + 34 + 18);
    expect(tabBarSpaceFor(48)).toBe(56 + 6 + 48 + 18);
  });

  it("支持追加留白（浮动按钮等）", () => {
    expect(tabBarSpaceFor(0, 24)).toBe(56 + 6 + 18 + 24);
    expect(tabBarSpaceFor(34, -1000)).toBe(56 + 6 + 34 + 18 - 1000);
  });

  it("异常的安全区（负值 / NaN）按 0 处理", () => {
    expect(tabBarSpaceFor(-1)).toBe(56 + 6 + 18);
    expect(tabBarSpaceFor(Number.NaN)).toBe(56 + 6 + 18);
  });
});

/**
 * v17 阶段 B 回归护栏：导航栈重构后，被 push 的子页会**盖住底栏**，
 * 若还按"底栏占位"留白，子页滚到底会多出一段死白；而 hub 页必须照旧让开底栏。
 */
describe("showsTabBar / tabBarSpaceForRoute", () => {
  it("只有 (tabs) 组内的 7 个路由显示底栏", () => {
    for (const p of TAB_BAR_ROUTES) expect(showsTabBar(p)).toBe(true);
    // 允许 trailing slash 与 query
    expect(showsTabBar("/today/")).toBe(true);
    expect(showsTabBar("/learn?tab=1")).toBe(true);
    expect(showsTabBar(null)).toBe(true); // 未知/首帧：保守按 hub 处理，避免内容被底栏压住
  });

  it("push 上来的子页不显示底栏", () => {
    for (const p of ["/tasks", "/habits", "/jobs", "/phase/abc", "/account-security", "/resume-preview"]) {
      expect(showsTabBar(p)).toBe(false);
    }
  });

  it("hub 页照旧让开底栏（底栏高 + 间距 + 安全区 + 呼吸）", () => {
    expect(tabBarSpaceForRoute("/today", 34)).toBe(tabBarSpaceFor(34));
    expect(tabBarSpaceForRoute("/settings", 0, 24)).toBe(tabBarSpaceFor(0, 24));
  });

  it("子页只留安全区（+ extra），不再多出底栏死白", () => {
    expect(tabBarSpaceForRoute("/tasks", 34)).toBe(34);
    expect(tabBarSpaceForRoute("/habits", 34, 16)).toBe(50);
    expect(tabBarSpaceForRoute("/jobs", Number.NaN)).toBe(0);
  });
});

describe("tabBarBottomFor", () => {
  it("页面自带的固定底栏停在悬浮胶囊之上", () => {
    expect(tabBarBottomFor(0)).toBe(56 + 6);
    expect(tabBarBottomFor(34)).toBe(56 + 6 + 34);
    expect(tabBarBottomFor(Number.NaN)).toBe(56 + 6);
  });
});
