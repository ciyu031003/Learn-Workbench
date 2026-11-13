import { describe, expect, it } from "vitest";
import { formatFocusClock } from "./focus-clock";

describe("formatFocusClock", () => {
  it("formats whole minutes", () => {
    expect(formatFocusClock(25 * 60)).toBe("25:00");
  });
  it("pads single-digit seconds", () => {
    expect(formatFocusClock(65)).toBe("01:05");
  });
  it("clamps negative and non-finite values to zero", () => {
    expect(formatFocusClock(-1)).toBe("00:00");
    expect(formatFocusClock(Number.NaN)).toBe("00:00");
  });
  it("keeps minutes above 99", () => {
    expect(formatFocusClock(125 * 60)).toBe("125:00");
  });
  it("floors fractional seconds", () => {
    expect(formatFocusClock(59.9)).toBe("00:59");
  });
});
