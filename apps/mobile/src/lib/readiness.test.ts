import { describe, it, expect } from "vitest";
import { computeReadiness } from "./readiness";

const base = {
  tasksTotal: 0,
  tasksDone: 0,
  habitsScheduled: 0,
  habitsDone: 0,
  workoutMinutes: 0,
  nutritionKcal: 0,
  nutritionTargetKcal: 0,
};

describe("computeReadiness", () => {
  it("全天无记录 → 待开始文案、0 分、不指短板", () => {
    const r = computeReadiness(base);
    expect(r.score).toBe(0);
    expect(r.verdict).toContain("先记一笔");
    expect(r.weakest).toBeNull();
  });

  it("权重：任务 40 + 习惯 30 + 训练 15 + 饮食 15", () => {
    const r = computeReadiness({
      ...base,
      tasksTotal: 4,
      tasksDone: 4,
      habitsScheduled: 2,
      habitsDone: 2,
      workoutMinutes: 40,
      nutritionKcal: 2000,
      nutritionTargetKcal: 2000,
    });
    expect(r.score).toBe(100);
    expect(r.verdict).toContain("状态很好");
    expect(r.weakest).toBeNull();
  });

  it("只有训练一项 → 15 分（不是 0 分），未配置的维度不算短板", () => {
    const r = computeReadiness({ ...base, workoutMinutes: 30 });
    expect(r.score).toBe(15);
    expect(r.weakest).toBeNull();
  });

  it("饮食超额不溢出（>100% 仍按 100% 计）", () => {
    const r = computeReadiness({ ...base, nutritionKcal: 5000, nutritionTargetKcal: 2000 });
    expect(r.score).toBe(15);
  });

  it("最短板取缺口最大的一项", () => {
    const r = computeReadiness({
      ...base,
      tasksTotal: 4,
      tasksDone: 1, // 缺口 0.75 × 权重 40 = 30
      habitsScheduled: 4,
      habitsDone: 0, // 缺口 1.0 × 权重 30 = 30
      nutritionKcal: 2000,
      nutritionTargetKcal: 2000,
    });
    // 习惯权重更低但完成度为 0，缺口按比例算后习惯更大
    expect(r.weakest).toBe("habits");
    expect(r.score).toBe(Math.round(0.25 * 40 + 0 + 0 + 15));
  });

  it("分数 ≥80 时不再提示短板（避免打击）", () => {
    const r = computeReadiness({
      ...base,
      tasksTotal: 1,
      tasksDone: 1,
      habitsScheduled: 1,
      habitsDone: 1,
      workoutMinutes: 20,
      nutritionKcal: 2000,
      nutritionTargetKcal: 2000,
    });
    expect(r.score).toBe(100);
    expect(r.weakest).toBeNull();
  });

  // v7 P2：健康页 hero 的分解条要用四项比例
  it("parts 返回四项 0..1 比例（训练按「有没有练」二值）", () => {
    const r = computeReadiness({
      ...base,
      tasksTotal: 4,
      tasksDone: 2,
      habitsScheduled: 4,
      habitsDone: 1,
      workoutMinutes: 25,
      nutritionKcal: 1000,
      nutritionTargetKcal: 2000,
    });
    expect(r.parts.tasks).toBe(0.5);
    expect(r.parts.habits).toBe(0.25);
    expect(r.parts.workout).toBe(1);
    expect(r.parts.nutrition).toBe(0.5);
  });

  it("异常输入（负数 / NaN）不产生 NaN 分", () => {
    const r = computeReadiness({ ...base, tasksTotal: -3, tasksDone: Number.NaN, habitsScheduled: Number.NaN });
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
