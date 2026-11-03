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
  TAB_BAR_SIDE_INSET,
  TAB_BAR_RADIUS,
} from "./tab-bar-metrics";

/**
 * 回归护栏：2026-09-15「底栏遮挡内容」——11 个页面 paddingBottom=40 而
 * 浮动底栏占 78pt，最后一行被压住。留白必须 ≥ 底栏高 + 安全区 + 呼吸。
 *
 * v2.1：底栏几何整体放大（62/8 → 66/10），断言全部改用常量，
 * 数值本身由下面的「几何契约」用例锁死，避免改一个数字要改十几处。
 */
describe("tabBarSpaceFor", () => {
  it("无安全区的设备也要让开悬浮胶囊本体与间距", () => {
    expect(tabBarSpaceFor(0)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING);
    expect(tabBarSpaceFor(0)).toBeGreaterThanOrEqual(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
  });

  it("叠加底部安全区（手势条 / 虚拟导航栏）", () => {
    expect(tabBarSpaceFor(34)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 34 + TAB_BAR_BREATHING);
    expect(tabBarSpaceFor(48)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 48 + TAB_BAR_BREATHING);
  });

  it("支持追加留白（浮动按钮等）", () => {
    expect(tabBarSpaceFor(0, 24)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING + 24);
    expect(tabBarSpaceFor(34, -1000)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 34 + TAB_BAR_BREATHING - 1000);
  });

  it("异常的安全区（负值 / NaN）按 0 处理", () => {
    expect(tabBarSpaceFor(-1)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING);
    expect(tabBarSpaceFor(Number.NaN)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING);
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
    expect(tabBarBottomFor(0)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
    expect(tabBarBottomFor(34)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 34);
    expect(tabBarBottomFor(Number.NaN)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
  });
});

/**
 * v2.1 几何契约（参考图 2：白色玻璃浮动胶囊）
 *
 * 这几个数字同时被 `components/v2/floating-tab-bar.tsx`（本体）与全部可滚动页
 * （`useTabBarSpace()` 的 paddingBottom）消费，任一处漂移都会让「胶囊 / 底部留白」
 * 对不上，所以在这里把区间与派生关系锁死。
 */
describe("底栏几何契约（v2.1 液态玻璃胶囊）", () => {
  it("胶囊高度落在参考图比例 64–68", () => {
    expect(TAB_BAR_HEIGHT).toBeGreaterThanOrEqual(64);
    expect(TAB_BAR_HEIGHT).toBeLessThanOrEqual(68);
  });

  it("左右留白落在参考图比例 12–16", () => {
    expect(TAB_BAR_SIDE_INSET).toBeGreaterThanOrEqual(12);
    expect(TAB_BAR_SIDE_INSET).toBeLessThanOrEqual(16);
  });

  it("全圆角 = 高度一半（两端完全半圆）", () => {
    expect(TAB_BAR_RADIUS).toBe(TAB_BAR_HEIGHT / 2);
  });

  it("底部留白（底栏高 + 悬浮间距）严格大于胶囊本体，内容不被压住", () => {
    expect(tabBarBottomFor(0)).toBeGreaterThan(TAB_BAR_HEIGHT);
    expect(tabBarSpaceFor(0, 0)).toBeGreaterThan(tabBarBottomFor(0));
  });

  it("几何较 v2.0（62/8）只增不减", () => {
    expect(TAB_BAR_HEIGHT).toBeGreaterThanOrEqual(62);
    expect(TAB_BAR_FLOAT_GAP).toBeGreaterThanOrEqual(8);
  });
});
