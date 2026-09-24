import { describe, it, expect } from "vitest";
import { ENERGY_LEVELS, energyLevelOf, isValidEnergyLevel } from "./energy-levels";

describe("energy levels", () => {
  it("有 1-5 五档且标签唯一", () => {
    expect(ENERGY_LEVELS.map((e) => e.level)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(ENERGY_LEVELS.map((e) => e.label)).size).toBe(5);
  });
  it("energyLevelOf 命中与未命中", () => {
    expect(energyLevelOf(3)?.label).toBe("一般");
    expect(energyLevelOf(9)).toBeNull();
    expect(energyLevelOf(null)).toBeNull();
  });
  it("校验只接受 1-5 整数", () => {
    expect(isValidEnergyLevel(1)).toBe(true);
    expect(isValidEnergyLevel(5)).toBe(true);
    expect(isValidEnergyLevel(0)).toBe(false);
    expect(isValidEnergyLevel(6)).toBe(false);
    expect(isValidEnergyLevel(1.5)).toBe(false);
    expect(isValidEnergyLevel("3")).toBe(false);
    expect(isValidEnergyLevel(null)).toBe(false);
  });
});
