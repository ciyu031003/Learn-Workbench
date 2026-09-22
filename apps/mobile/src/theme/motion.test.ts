import { describe, expect, it, vi } from "vitest";
import {
  EASE_OVERSHOOT_POINTS,
  EASE_STANDARD_POINTS,
  MOTION_BASE,
  MOTION_ENABLED,
  MOTION_FAST,
  MOTION_SLOW,
  easingOvershoot,
  easingStandard,
  isMotionActive,
  motion,
  motionDuration,
  motionTokenDuration,
} from "./motion";

/**
 * v13 U1：动效 token 单测。
 *
 * `theme/motion.ts` 在运行期需要 reanimated 的 `Easing.bezier`（worklet 化函数），
 * 但 vitest 的 node 环境加载不了 reanimated 的原生 worklets（看板踩坑：worklets
 * "Cannot find module .../initializers"），所以这里把 reanimated 整个 mock 掉，
 * 并**记录 bezier 的入参**来校验曲线与 Web 的 cubic-bezier 数值一致。
 */
const bezierCalls = vi.hoisted(() => [] as number[][]);

vi.mock("react-native-reanimated", () => ({
  Easing: {
    bezier: (x1: number, y1: number, x2: number, y2: number) => {
      bezierCalls.push([x1, y1, x2, y2]);
      // 最小可用替身：保持"函数"语义（端点 0→0 / 1→1 由 CSS 语义保证，这里不复刻求解器）
      return (t: number) => t;
    },
  },
}));

describe("v13 motion token", () => {
  it("时长 token 与 Web --motion-fast/base/slow 一致", () => {
    expect(motion).toEqual({ fast: 150, base: 240, slow: 400 });
    expect([MOTION_FAST, MOTION_BASE, MOTION_SLOW]).toEqual([150, 240, 400]);
  });

  it("缓动曲线控制点与 Web --ease-standard / --ease-overshoot 一致", () => {
    expect([...EASE_STANDARD_POINTS]).toEqual([0.22, 0.61, 0.36, 1]);
    expect([...EASE_OVERSHOOT_POINTS]).toEqual([0.8, 0.5, 0.2, 1.4]);
    expect(bezierCalls).toContainEqual([0.22, 0.61, 0.36, 1]);
    expect(bezierCalls).toContainEqual([0.8, 0.5, 0.2, 1.4]);
  });

  it("导出的缓动是可传给 withTiming 的函数", () => {
    expect(typeof easingStandard).toBe("function");
    expect(typeof easingOvershoot).toBe("function");
  });

  it("总开关默认打开", () => {
    expect(MOTION_ENABLED).toBe(true);
  });

  it("isMotionActive：系统减弱动态 或 总开关关闭 → 不播", () => {
    expect(isMotionActive(false)).toBe(true);
    expect(isMotionActive(true)).toBe(false);
    expect(isMotionActive(false, false)).toBe(false);
    expect(isMotionActive(true, false)).toBe(false);
    expect(isMotionActive(false, true)).toBe(true);
  });

  it("motionDuration：不可播时归零，可播时透传（非法值归零）", () => {
    expect(motionDuration(240, false)).toBe(240);
    expect(motionDuration(240, true)).toBe(0);
    expect(motionDuration(240, false, false)).toBe(0);
    expect(motionDuration(0, false)).toBe(0);
    expect(motionDuration(-10, false)).toBe(0);
    expect(motionDuration(Number.NaN, false)).toBe(0);
  });

  it("motionTokenDuration：按 token 取名，降级时归零", () => {
    expect(motionTokenDuration("fast", false)).toBe(150);
    expect(motionTokenDuration("base", false)).toBe(240);
    expect(motionTokenDuration("slow", false)).toBe(400);
    expect(motionTokenDuration("slow", true)).toBe(0);
  });
});
