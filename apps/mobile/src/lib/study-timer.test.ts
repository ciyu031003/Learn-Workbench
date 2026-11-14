import { describe, expect, it } from "vitest";
import { MIN_STUDY_SECONDS, createStudyClock, shouldRecordStudy, studyMinutesLabel } from "./study-timer";

describe("study-timer", () => {
  it("counts wall clock seconds between start and stop", () => {
    let now = 1_000_000;
    const clock = createStudyClock(() => now);
    expect(clock.running()).toBe(false);
    clock.start();
    expect(clock.running()).toBe(true);
    now += 125_400;
    expect(clock.elapsed()).toBe(125);
    expect(clock.stop()).toBe(125);
    expect(clock.running()).toBe(false);
    expect(clock.stop()).toBe(0);
  });

  it("does not reset an already running segment", () => {
    let now = 0;
    const clock = createStudyClock(() => now);
    clock.start();
    now += 10_000;
    clock.start();
    now += 5_000;
    expect(clock.stop()).toBe(15);
  });

  it("only records after the minimum threshold", () => {
    expect(MIN_STUDY_SECONDS).toBe(30);
    expect(shouldRecordStudy(29)).toBe(false);
    expect(shouldRecordStudy(30)).toBe(true);
    expect(shouldRecordStudy(Number.NaN)).toBe(false);
  });

  it("formats the in-page label from one minute up", () => {
    expect(studyMinutesLabel(59)).toBeNull();
    expect(studyMinutesLabel(60)).toBe("本次已学 1 分钟");
    expect(studyMinutesLabel(185)).toBe("本次已学 3 分钟");
  });
});
