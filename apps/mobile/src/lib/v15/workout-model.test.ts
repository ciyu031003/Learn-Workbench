import { describe, expect, it } from "vitest";
import type { Workout } from "@learn-workbench/shared/schemas";
import { buildExerciseComposition, buildWorkoutWeek, recentWorkouts, weekGoalPct } from "./workout-model";

function workout(id: number, date: string, minutes: number, items: { label: string; sets: number; reps: number; weight: number | null }[]): Workout {
  return {
    id,
    name: "训练 " + id,
    exercisedOn: date,
    durationSeconds: minutes * 60,
    note: null,
    items: items.map((item) => ({
      id,
      exerciseLabel: item.label,
      sets: item.sets,
      reps: item.reps,
      weightKg: item.weight,
      durationSeconds: 0,
      sortOrder: 0,
    })),
  };
}

describe("v15 workout model", () => {
  const monday = "2026-11-23";
  const friday = "2026-11-27";
  const rows = [
    workout(1, monday, 40, [{ label: "卧推", sets: 4, reps: 8, weight: 60 }]),
    workout(2, friday, 30, [{ label: "深蹲", sets: 5, reps: 5, weight: 80 }]),
    workout(3, "2026-11-20", 50, [{ label: "硬拉", sets: 3, reps: 5, weight: 100 }]),
  ];

  it("只统计自然周（周一~周日），未来日为 0", () => {
    const week = buildWorkoutWeek(rows, friday);
    expect(week.keys[0]).toBe("2026-11-23");
    expect(week.keys[6]).toBe("2026-11-29");
    expect(week.sessions).toBe(2);
    expect(week.minutes).toBe(70);
    expect(week.sets).toBe(9);
    expect(week.days.find((day) => day.key === friday)?.active).toBe(true);
    expect(week.days.find((day) => day.key === "2026-11-29")?.minutes).toBe(0);
  });

  it("目标百分比封顶 100", () => {
    expect(weekGoalPct(87)).toBe(58);
    expect(weekGoalPct(500)).toBe(100);
  });

  it("动作构成按组数占比，并合并其他", () => {
    const rows5 = [
      workout(1, friday, 30, [
        { label: "A", sets: 4, reps: 8, weight: null },
        { label: "B", sets: 3, reps: 8, weight: null },
        { label: "C", sets: 2, reps: 8, weight: null },
        { label: "D", sets: 1, reps: 8, weight: null },
        { label: "E", sets: 1, reps: 8, weight: null },
      ]),
    ];
    const comp = buildExerciseComposition(rows5, friday, 4);
    expect(comp).toHaveLength(5);
    expect(comp[0].label).toBe("A");
    expect(comp[4]).toMatchObject({ label: "其他", sets: 1 });
  });

  it("最近训练按日期倒序", () => {
    expect(recentWorkouts(rows).map((row) => row.id)).toEqual([2, 1, 3]);
  });
});
