import { describe, expect, it } from "vitest";
import {
  LEARNING_POINT_STATES,
  derivePointState,
  isPointComplete,
  pointStateCount,
  summarizePointStates,
} from "./learning-states";

describe("derivePointState", () => {
  it("什么都没做 → 五个状态全灭", () => {
    const state = derivePointState({});
    expect(LEARNING_POINT_STATES.every((key) => state[key] === false)).toBe(true);
    expect(state.accuracy).toBe(0);
  });

  it("读过即点亮「阅读」，哪怕没做题", () => {
    const state = derivePointState({ readProgress: 30 });
    expect(state.read).toBe(true);
    expect(state.practice).toBe(false);
    expect(state.mastery).toBe(false);
  });

  it("做过题才点亮「练习」；正确率达标才点亮「掌握」", () => {
    const practicing = derivePointState({ latestCorrect: [true, false, true, false] });
    expect(practicing.practice).toBe(true);
    expect(practicing.mastery).toBe(false); // 50% < 80%
    expect(practicing.review).toBe(true); // 有错题 → 待复习

    const nearly = derivePointState({ latestCorrect: [true, true, true, false] });
    expect(nearly.mastery).toBe(false); // 75% < 80%
  });

  it("正确率门槛按 0.8 判定（边界）", () => {
    expect(derivePointState({ latestCorrect: [true, true, true, true, false] }).mastery).toBe(true); // 80%
    expect(derivePointState({ latestCorrect: [true, true, true, false] }).mastery).toBe(false); // 75%
  });

  it("到期复习卡或存在错题 → 「复习」要点亮", () => {
    expect(derivePointState({ latestCorrect: [true], dueForReview: false }).review).toBe(false);
    expect(derivePointState({ latestCorrect: [true], dueForReview: true }).review).toBe(true);
  });

  it("收藏作为「实践」的代理信号", () => {
    expect(derivePointState({ favorite: true }).apply).toBe(true);
  });

  it("读+练+掌握+实践齐了算学完；复习是待办提示不计入达成", () => {
    const state = derivePointState({ readProgress: 100, latestCorrect: [true, true], favorite: true });
    expect(state.review).toBe(false); // 无错题、无到期
    expect(pointStateCount(state)).toBe(4);
    expect(isPointComplete(state)).toBe(true);
  });
});

describe("summarizePointStates", () => {
  it("逐状态计数并统计「全达成」", () => {
    const summary = summarizePointStates({
      a: derivePointState({ readProgress: 100, latestCorrect: [true], favorite: true, dueForReview: true }),
      b: derivePointState({ readProgress: 20 }),
      c: derivePointState({ latestCorrect: [true, true, true, true, false] }),
    });
    expect(summary.total).toBe(3);
    expect(summary.byState.read).toBe(2); // a、b 读过
    expect(summary.byState.practice).toBe(2); // a、c 练过
    expect(summary.byState.mastery).toBe(2); // a、c 达标
    expect(summary.byState.review).toBe(2); // a 到期、c 有错题
    expect(summary.byState.apply).toBe(1); // a 收藏
    expect(summary.complete).toBe(1); // 只有 a 读+练+掌握+实践齐了
  });

  it("空集合返回零值", () => {
    expect(summarizePointStates({})).toEqual({
      total: 0,
      byState: { read: 0, practice: 0, mastery: 0, review: 0, apply: 0 },
      complete: 0,
    });
  });
});
