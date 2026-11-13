import { describe, expect, it } from "vitest";
import {
  TAB_BAR_BREATHING,
  TAB_BAR_FLOAT_GAP,
  TAB_BAR_HEIGHT,
  TAB_BAR_ITEM_MIN_HEIGHT,
  TAB_BAR_RADIUS,
  TAB_BAR_ROUTES,
  TAB_BAR_SIDE_INSET,
  showsTabBar,
  tabBarBottomFor,
  tabBarRowPaddingBottom,
  tabBarSpaceFor,
  tabBarSpaceForRoute,
  tabBarTotalHeight,
} from "./tab-bar-metrics";

describe("tabBarSpaceFor", () => {
  it("reserves capsule height, float gap, and breathing room without safe area", () => {
    expect(tabBarSpaceFor(0)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING);
    expect(tabBarSpaceFor(0)).toBeGreaterThan(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
  });

  it("adds the bottom safe area on top of the floating capsule", () => {
    expect(tabBarSpaceFor(34)).toBe(
      TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 34 + TAB_BAR_BREATHING,
    );
    expect(tabBarSpaceFor(48)).toBe(
      TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 48 + TAB_BAR_BREATHING,
    );
  });

  it("supports extra reserved space and sanitizes invalid insets", () => {
    expect(tabBarSpaceFor(0, 24)).toBe(
      TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING + 24,
    );
    expect(tabBarSpaceFor(-1)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING);
    expect(tabBarSpaceFor(Number.NaN)).toBe(
      TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + TAB_BAR_BREATHING,
    );
  });
});

describe("showsTabBar / tabBarSpaceForRoute", () => {
  it("shows the bar only on hub routes", () => {
    for (const p of TAB_BAR_ROUTES) expect(showsTabBar(p)).toBe(true);
    expect(showsTabBar("/today/")).toBe(true);
    expect(showsTabBar("/learn?tab=1")).toBe(true);
    expect(showsTabBar(null)).toBe(true);
  });

  it("does not reserve bar space on pushed child pages", () => {
    for (const p of [
      "/tasks",
      "/habits",
      "/jobs",
      "/phase/abc",
      "/account-security",
      "/resume-preview",
    ]) {
      expect(showsTabBar(p)).toBe(false);
    }
  });

  it("uses full floating space on hub routes and only safe area on child pages", () => {
    expect(tabBarSpaceForRoute("/today", 34)).toBe(tabBarSpaceFor(34));
    expect(tabBarSpaceForRoute("/settings", 0, 24)).toBe(tabBarSpaceFor(0, 24));
    expect(tabBarSpaceForRoute("/tasks", 34)).toBe(34);
    expect(tabBarSpaceForRoute("/habits", 34, 16)).toBe(50);
    expect(tabBarSpaceForRoute("/jobs", Number.NaN)).toBe(0);
  });
});

describe("floating geometry", () => {
  it("uses a 70pt capsule with side gutters and a large radius", () => {
    expect(TAB_BAR_HEIGHT).toBe(70);
    expect(TAB_BAR_SIDE_INSET).toBe(12);
    expect(TAB_BAR_RADIUS).toBe(22);
    expect(TAB_BAR_FLOAT_GAP).toBe(12);
  });

  it("keeps the row fully available for icons and labels", () => {
    for (const inset of [0, 24, 34, 48]) {
      expect(tabBarTotalHeight(inset) - tabBarRowPaddingBottom(inset)).toBe(
        TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + inset,
      );
    }
    expect(tabBarRowPaddingBottom(34)).toBe(0);
    expect(TAB_BAR_HEIGHT).toBeGreaterThanOrEqual(TAB_BAR_ITEM_MIN_HEIGHT);
  });

  it("places page-owned fixed controls above the floating capsule", () => {
    expect(tabBarBottomFor(0)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
    expect(tabBarBottomFor(34)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP + 34);
    expect(tabBarBottomFor(Number.NaN)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
  });

  it("sanitizes invalid safe areas", () => {
    expect(tabBarTotalHeight(Number.NaN)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
    expect(tabBarTotalHeight(-10)).toBe(TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP);
  });
});