import { describe, it, expect } from "vitest";
import { tabBarSpaceFor, tabBarBottomFor, TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT, TAB_BAR_BREATHING } from "./tab-bar-metrics";

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

describe("tabBarBottomFor", () => {
  it("页面自带的固定底栏停在悬浮胶囊之上", () => {
    expect(tabBarBottomFor(0)).toBe(56 + 6);
    expect(tabBarBottomFor(34)).toBe(56 + 6 + 34);
    expect(tabBarBottomFor(Number.NaN)).toBe(56 + 6);
  });
});
