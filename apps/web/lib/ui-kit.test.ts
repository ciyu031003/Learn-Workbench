import { describe, expect, it } from "vitest";
import { clampPercent, humanSize, ringStyle, toastLifeMs, UPLOAD_MAX_BYTES } from "./ui-kit";

describe("ui-kit（v13 技法组件的纯逻辑）", () => {
  it("clampPercent 收敛到 0–100 并吞掉脏值", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(42.6)).toBe(42.6);
    expect(clampPercent(180)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(undefined)).toBe(0);
  });

  it("toastLifeMs：错误停留更久", () => {
    expect(toastLifeMs("error")).toBe(4200);
    expect(toastLifeMs("success")).toBe(3200);
    expect(toastLifeMs()).toBe(3200);
  });

  it("ringStyle 生成 conic 环所需的 CSS 变量", () => {
    expect(ringStyle({ value: 55, thickness: 12 })).toEqual({ "--ring-value": "55", "--ring-size": "12px" });
    const s = ringStyle({ value: 200, from: "#111", to: "#222", track: "#333" });
    expect(s["--ring-value"]).toBe("100");
    expect(s["--ring-from"]).toBe("#111");
    expect(s["--ring-track"]).toBe("#333");
  });

  it("humanSize 与 5MB 上限口径一致", () => {
    expect(UPLOAD_MAX_BYTES).toBe(5242880);
    expect(humanSize(0)).toBe("0 KB");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
