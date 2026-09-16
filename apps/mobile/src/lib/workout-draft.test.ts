import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPS,
  DEFAULT_SETS,
  dateOptions,
  draftFromWorkout,
  newDraftItem,
  stepNumber,
  stepWeight,
  toPayloadItems,
} from "./workout-draft";
import type { Workout } from "@learn-workbench/shared";

describe("stepNumber / stepWeight", () => {
  it("空值先取 fallback 再步进（不会变成 NaN 或 0）", () => {
    expect(stepNumber("", 1, 1, 30, 4)).toBe("5");
    expect(stepNumber("", -1, 1, 30, 4)).toBe("3");
    expect(stepNumber("abc", 1, 1, 30, 4)).toBe("5");
  });

  it("按范围钳位", () => {
    expect(stepNumber("30", 1, 1, 30, 4)).toBe("30");
    expect(stepNumber("1", -1, 1, 30, 4)).toBe("1");
  });

  it("重量按 2.5 递增、保留 1 位小数、0 显示为空", () => {
    expect(stepWeight("", 2.5)).toBe("2.5");
    expect(stepWeight("60", 2.5)).toBe("62.5");
    expect(stepWeight("60", -2.5)).toBe("57.5");
    expect(stepWeight("2.5", -2.5)).toBe("");
    expect(stepWeight("-5", 2.5)).toBe("2.5");
  });
});

describe("toPayloadItems", () => {
  it("丢掉没填动作名的行，并把数值转成数字", () => {
    const out = toPayloadItems([
      newDraftItem({ exerciseLabel: "  卧推  ", exerciseKey: "bench-press", sets: "4", reps: "8", weightKg: "60" }),
      newDraftItem({ exerciseLabel: "   " }),
    ]);
    expect(out).toEqual([
      { exerciseKey: "bench-press", exerciseLabel: "卧推", sets: 4, reps: 8, weightKg: 60 },
    ]);
  });

  it("空重量 → null（服务端语义：自重动作）", () => {
    expect(toPayloadItems([newDraftItem({ exerciseLabel: "俯卧撑", weightKg: "  " })])[0].weightKg).toBeNull();
  });

  it("越界/非法数值钳到服务端范围，不会发 0 组 0 次", () => {
    const out = toPayloadItems([
      newDraftItem({ exerciseLabel: "深蹲", sets: "999", reps: "0", weightKg: "99999" }),
      newDraftItem({ exerciseLabel: "硬拉", sets: "abc", reps: "", weightKg: "abc" }),
    ]);
    expect(out[0]).toMatchObject({ sets: 200, reps: 1, weightKg: 2000 });
    expect(out[1]).toMatchObject({ sets: 1, reps: 1, weightKg: null });
  });

  it("重量保留 1 位小数", () => {
    expect(toPayloadItems([newDraftItem({ exerciseLabel: "卧推", weightKg: "62.55" })])[0].weightKg).toBe(62.6);
  });
});

const workout: Workout = {
  id: 12,
  name: "胸 + 三头",
  exercisedOn: "2026-09-14",
  durationSeconds: 0,
  note: null,
  items: [
    { exerciseKey: "bench-press", exerciseLabel: "卧推", sets: 4, reps: 8, weightKg: 60, durationSeconds: 0, sortOrder: 0 },
    { exerciseKey: null, exerciseLabel: "自由动作", sets: 3, reps: 12, weightKg: null, durationSeconds: 0, sortOrder: 1 },
  ],
};

describe("draftFromWorkout", () => {
  it("回填名称 / 日期 / 动作（含自由动作与空重量）", () => {
    const d = draftFromWorkout(workout);
    expect(d.name).toBe("胸 + 三头");
    expect(d.date).toBe("2026-09-14");
    expect(d.items).toEqual([
      { exerciseKey: "bench-press", exerciseLabel: "卧推", sets: "4", reps: "8", weightKg: "60" },
      { exerciseKey: null, exerciseLabel: "自由动作", sets: "3", reps: "12", weightKg: "" },
    ]);
  });

  it("没有动作明细时给一行空草稿（不出现空列表）", () => {
    const d = draftFromWorkout({ ...workout, items: [] });
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ exerciseLabel: "", sets: DEFAULT_SETS, reps: DEFAULT_REPS });
  });
});

describe("dateOptions", () => {
  it("默认给出今天 / 昨天 / 前天", () => {
    expect(dateOptions("2026-09-16")).toEqual([
      { key: "2026-09-16", label: "今天" },
      { key: "2026-09-15", label: "昨天" },
      { key: "2026-09-14", label: "前天" },
    ]);
  });

  it("编辑历史记录时把原日期补成一项（避免一进编辑日期就被改成今天）", () => {
    const out = dateOptions("2026-09-16", "2026-08-02");
    expect(out[0]).toEqual({ key: "2026-08-02", label: "08/02" });
    expect(out).toHaveLength(4);
  });

  it("原日期就是今天/昨天/前天时不重复添加", () => {
    expect(dateOptions("2026-09-16", "2026-09-15")).toHaveLength(3);
    expect(dateOptions("2026-09-16", "")).toHaveLength(3);
    expect(dateOptions("2026-09-16", "坏日期")).toHaveLength(3);
  });
});
