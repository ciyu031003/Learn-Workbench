import { describe, it, expect } from "vitest";
import { buildTodayPlan, computeNextTriggerMs } from "./wellbeing";

describe("buildTodayPlan", () => {
  it("always includes focus + hydrate, and a low-focus item when focus <= 0", () => {
    const plan = buildTodayPlan({ focusMinutes: 0, energyLevel: null, breakDue: false });
    expect(plan.map((p) => p.kind)).toContain("focus");
    expect(plan.map((p) => p.kind)).toContain("hydrate");
    expect(plan.find((p) => p.kind === "focus")?.label).toBe("安排一段专注学习");
  });

  it("shows achieved focus minutes when focus > 0", () => {
    const plan = buildTodayPlan({ focusMinutes: 125, energyLevel: null, breakDue: false });
    expect(plan.find((p) => p.kind === "focus")?.label).toContain("今日已专注 125 分钟");
  });

  it("adds a break suggestion when breakDue", () => {
    const plan = buildTodayPlan({ focusMinutes: 60, energyLevel: 3, breakDue: true });
    expect(plan.some((p) => p.kind === "break")).toBe(true);
  });

  it("does not add break when not due", () => {
    const plan = buildTodayPlan({ focusMinutes: 10, energyLevel: 3, breakDue: false });
    expect(plan.some((p) => p.kind === "break")).toBe(false);
  });

  it("prompts energy recording when energyLevel is null", () => {
    const plan = buildTodayPlan({ focusMinutes: 30, energyLevel: null, breakDue: false });
    const e = plan.find((p) => p.kind === "energy");
    expect(e?.label).toContain("记录一下当前精力");
  });

  it("suggests low-impact work when energy is low (<= 2)", () => {
    const plan = buildTodayPlan({ focusMinutes: 30, energyLevel: 2, breakDue: false });
    expect(plan.find((p) => p.kind === "energy")?.label).toContain("精力偏低");
  });

  it("suggests tackling hard tasks when energy is high (>= 4)", () => {
    const plan = buildTodayPlan({ focusMinutes: 30, energyLevel: 5, breakDue: false });
    expect(plan.find((p) => p.kind === "energy")?.label).toContain("精力在线");
  });

  it("omits energy item at neutral level 3", () => {
    const plan = buildTodayPlan({ focusMinutes: 30, energyLevel: 3, breakDue: false });
    expect(plan.some((p) => p.kind === "energy")).toBe(false);
  });

  it("always ends with hydration", () => {
    const plan = buildTodayPlan({ focusMinutes: 60, energyLevel: 4, breakDue: true });
    expect(plan[plan.length - 1].kind).toBe("hydrate");
  });
});

describe("computeNextTriggerMs", () => {
  it("returns the next in-window tick", () => {
    const from = new Date(2026, 0, 5, 9, 0, 0); // Monday 09:00
    const t = computeNextTriggerMs({
      intervalMinutes: 60,
      startTime: "09:00",
      endTime: "10:00",
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      from,
    });
    expect(t).toBe(new Date(2026, 0, 5, 10, 0, 0).getTime());
  });

  it("skips weekdays that are not allowed", () => {
    const from = new Date(2026, 0, 2, 9, 0, 0); // Friday
    const t = computeNextTriggerMs({
      intervalMinutes: 60,
      startTime: "09:00",
      endTime: "10:00",
      weekdays: [6, 7], // only weekend
      from,
    });
    expect(t).toBe(new Date(2026, 0, 3, 9, 0, 0).getTime()); // Saturday 09:00
  });

  it("falls back to `now + step` when no weekday matches", () => {
    const from = new Date(2026, 0, 5, 12, 0, 0);
    const step = 30 * 60000;
    const t = computeNextTriggerMs({
      intervalMinutes: 30,
      startTime: "09:00",
      endTime: "10:00",
      weekdays: [],
      from,
    });
    expect(t).toBe(from.getTime() + step);
  });

  it("clamps a non-positive interval to 1 minute", () => {
    const from = new Date(2026, 0, 5, 12, 0, 0);
    const t = computeNextTriggerMs({
      intervalMinutes: 0,
      startTime: "09:00",
      endTime: "10:00",
      weekdays: [],
      from,
    });
    expect(t).toBe(from.getTime() + 60000);
  });
});
