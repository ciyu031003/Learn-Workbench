import { describe, expect, it } from "vitest";
import {
  bedtimeOffsetToClock,
  buildEnergyPlan,
  buildHealthBriefing,
  buildNutritionBaseline,
  buildSleepAssessment,
  clockToBedtimeOffset,
  inQuietHours,
  nextReminderOccurrences,
  reminderBlockedByQuietHours,
  type NutritionDaySample,
  type SleepNightSample,
} from "@learn-workbench/shared/health-rules";

function nutritionDays(count: number, values: Partial<NutritionDaySample> = {}): NutritionDaySample[] {
  return Array.from({ length: 28 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return {
      date: `2026-11-${day}`,
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      entryCount: 0,
      ...values,
      ...(i < count ? {} : { entryCount: 0, kcal: 0 }),
    };
  });
}

function sleepNights(count: number, values: Partial<SleepNightSample> = {}): SleepNightSample[] {
  return Array.from({ length: 28 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return {
      date: `2026-11-${day}`,
      durationMin: 450,
      efficiencyPct: 95,
      deepPct: 18,
      remPct: 22,
      awakeCount: 0,
      bedtimeOffsetMin: -30,
      ...values,
      ...(i < count ? {} : { durationMin: 0 }),
    };
  });
}

describe("health rules · 能量与宏量营养", () => {
  it("Mifflin-St Jeor + 活动系数 + 维持目标", () => {
    const plan = buildEnergyPlan(
      { weightKg: 70, heightCm: 175, birthYear: 1998, sex: "male", activityLevel: "moderate" },
      new Date(2026, 10, 28)
    );
    expect(plan.bmr).toBe(1659);
    expect(plan.tdee).toBe(2571);
    expect(plan.kcal).toBe(2571);
    expect(plan.proteinG).toBe(98);
    expect(plan.fatG).toBeGreaterThanOrEqual(42);
    expect(plan.carbsG).toBeGreaterThan(300);
    expect(plan.computed).toBe(true);
    expect(plan.confidence).toBe("high");
  });

  it("减脂目标下调 15%，蛋白质按 1.8 g/kg", () => {
    const plan = buildEnergyPlan(
      {
        weightKg: 60,
        heightCm: 165,
        birthYear: 1995,
        sex: "female",
        activityLevel: "light",
        bodyGoal: "lose",
      },
      new Date(2026, 10, 28)
    );
    expect(plan.bmr).toBe(1315);
    expect(plan.tdee).toBe(1808);
    expect(plan.kcal).toBe(1537);
    expect(plan.proteinG).toBe(108);
    expect(plan.proteinPerKg).toBe(1.8);
  });

  it("极低目标套安全下限", () => {
    const plan = buildEnergyPlan(
      {
        weightKg: 45,
        heightCm: 150,
        birthYear: 1960,
        sex: "female",
        activityLevel: "sedentary",
        bodyGoal: "lose",
      },
      new Date(2026, 10, 28)
    );
    expect(plan.kcal).toBe(1200);
    expect(plan.floorApplied).toBe(true);
    expect(plan.notes.join(" ")).toContain("安全下限");
  });

  it("身体数据缺失时回落到默认值，并降低置信度", () => {
    const plan = buildEnergyPlan({ weightKg: 60 }, new Date(2026, 10, 28));
    expect(plan.computed).toBe(false);
    expect(plan.kcal).toBe(2000);
    expect(plan.confidence).toBe("low");
    expect(plan.proteinG).toBe(84);
  });

  it("训练频率 >=3 时提高蛋白系数但不超过 2.2", () => {
    const plan = buildEnergyPlan(
      { weightKg: 80, heightCm: 180, birthYear: 1990, sex: "male", activityLevel: "high", trainingDaysPerWeek: 5 },
      new Date(2026, 10, 28)
    );
    expect(plan.proteinPerKg).toBeLessThanOrEqual(2.2);
    expect(plan.proteinG).toBeGreaterThan(100);
  });
});

describe("health rules · 7/28 天营养基线", () => {
  it("7 天需要 5 个有效日 + 14 条记录", () => {
    const base = buildNutritionBaseline(nutritionDays(5, { kcal: 1900, proteinG: 80, entryCount: 3 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    expect(base.validDays).toBe(5);
    expect(base.totalEntries).toBe(15);
    expect(base.meetsMinimum).toBe(true);
    expect(base.confidence).toBe("early");
    expect(base.avgKcal).toBe(1900);
  });

  it("4 天或单条目日不算达标", () => {
    const base = buildNutritionBaseline(nutritionDays(4, { kcal: 1900, proteinG: 80, entryCount: 3 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    expect(base.meetsMinimum).toBe(false);
    expect(base.validDays).toBe(4);
    const sparse = buildNutritionBaseline(nutritionDays(7, { kcal: 1900, proteinG: 80, entryCount: 1 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    expect(sparse.validDays).toBe(0);
  });

  it("28 天 18 天为四周基线，24 天且 60 条为稳定基线", () => {
    const moderate = buildNutritionBaseline(nutritionDays(18, { kcal: 2000, proteinG: 90, entryCount: 3 }), {
      windowDays: 28,
      endDate: "2026-11-28",
    });
    expect(moderate.meetsMinimum).toBe(true);
    expect(moderate.confidence).toBe("moderate");
    const stable = buildNutritionBaseline(nutritionDays(24, { kcal: 2000, proteinG: 90, entryCount: 3 }), {
      windowDays: 28,
      endDate: "2026-11-28",
    });
    expect(stable.confidence).toBe("stable");
  });

  it("只统计窗口内的日期", () => {
    const base = buildNutritionBaseline(nutritionDays(10, { kcal: 1800, proteinG: 80, entryCount: 3 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    expect(base.validDays).toBe(7);
  });
});

describe("health rules · 睡眠综合判定", () => {
  it("5 晚理想睡眠给满分", () => {
    const sleep = buildSleepAssessment(sleepNights(5), { windowDays: 7, endDate: "2026-11-07" });
    expect(sleep.meetsMinimum).toBe(true);
    expect(sleep.score).toBe(100);
    expect(sleep.confidence).toBe("early");
    expect(sleep.components).toHaveLength(6);
    expect(sleep.components.reduce((sum, c) => sum + c.weightPct, 0)).toBeGreaterThanOrEqual(99);
  });

  it("少于 5 晚不给综合分", () => {
    const sleep = buildSleepAssessment(sleepNights(4), { windowDays: 7, endDate: "2026-11-07" });
    expect(sleep.meetsMinimum).toBe(false);
    expect(sleep.score).toBeNull();
    expect(sleep.note).toContain("至少需要 5 晚");
  });

  it("短睡 + 晚睡 + 波动大触发标记并拉低分数", () => {
    const sleep = buildSleepAssessment(
      sleepNights(7, { durationMin: 390, bedtimeOffsetMin: 70, efficiencyPct: 80, deepPct: 10 }),
      { windowDays: 7, endDate: "2026-11-07", bedtimeTarget: "23:30" }
    );
    expect(sleep.score).not.toBeNull();
    expect(sleep.score as number).toBeLessThan(80);
    expect(sleep.flags.shortSleep).toBe(true);
    expect(sleep.flags.lateBedtime).toBe(true);
    expect(sleep.flags.lowDeep).toBe(true);
    expect(sleep.debtMin).toBe(420);
  });

  it("缺失分期时只重分配可用权重，不把缺失当 0 分", () => {
    const sleep = buildSleepAssessment(
      sleepNights(5, { efficiencyPct: null, deepPct: null, remPct: null }),
      { windowDays: 7, endDate: "2026-11-07" }
    );
    const stages = sleep.components.find((c) => c.key === "stages");
    const efficiency = sleep.components.find((c) => c.key === "efficiency");
    expect(stages?.available).toBe(false);
    expect(efficiency?.available).toBe(false);
    expect(sleep.score).toBe(100);
  });

  it("28 天 18 晚为四周基线，24 晚为稳定基线", () => {
    const moderate = buildSleepAssessment(sleepNights(18), { windowDays: 28, endDate: "2026-11-28" });
    expect(moderate.confidence).toBe("moderate");
    const stable = buildSleepAssessment(sleepNights(24), { windowDays: 28, endDate: "2026-11-28" });
    expect(stable.confidence).toBe("stable");
  });
});

describe("health rules · 洞察与提醒", () => {
  const plan = buildEnergyPlan(
    { weightKg: 70, heightCm: 175, birthYear: 1998, sex: "male", activityLevel: "moderate" },
    new Date(2026, 10, 28)
  );

  it("数据不足时只提示继续记录，不发蛋白提醒", () => {
    const nutrition7 = buildNutritionBaseline(nutritionDays(3, { kcal: 1200, proteinG: 40, entryCount: 3 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    const nutrition28 = buildNutritionBaseline([], { windowDays: 28 });
    const sleep7 = buildSleepAssessment([], { windowDays: 7 });
    const sleep28 = buildSleepAssessment([], { windowDays: 28 });
    const briefing = buildHealthBriefing({ plan, nutrition7, nutrition28, sleep7, sleep28 });
    expect(briefing.reminders).toHaveLength(0);
    expect(briefing.insights.map((i) => i.key)).toContain("nutrition-collecting");
    expect(briefing.insights.map((i) => i.key)).toContain("sleep-collecting");
  });

  it("一周数据达标且蛋白低于 80% 时触发蛋白提醒", () => {
    const nutrition7 = buildNutritionBaseline(nutritionDays(5, { kcal: 2100, proteinG: 60, entryCount: 3 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    const nutrition28 = buildNutritionBaseline([], { windowDays: 28 });
    const sleep7 = buildSleepAssessment(sleepNights(5), { windowDays: 7, endDate: "2026-11-07" });
    const sleep28 = buildSleepAssessment([], { windowDays: 28 });
    const briefing = buildHealthBriefing({ plan, nutrition7, nutrition28, sleep7, sleep28 });
    const protein = briefing.reminders.find((r) => r.key === "protein");
    expect(protein?.active).toBe(true);
    expect(protein?.hour).toBe(16);
    expect(protein?.minute).toBe(30);
    expect(briefing.insights.find((i) => i.key === "protein-low")?.confidence).toBe("early");
  });

  it("短睡达到 5 晚时触发早睡提醒，默认 23:30 目标 -> 22:00 提醒", () => {
    const nutrition7 = buildNutritionBaseline([], { windowDays: 7 });
    const nutrition28 = buildNutritionBaseline([], { windowDays: 28 });
    const sleep7 = buildSleepAssessment(sleepNights(5, { durationMin: 390 }), {
      windowDays: 7,
      endDate: "2026-11-07",
    });
    const sleep28 = buildSleepAssessment([], { windowDays: 28 });
    const briefing = buildHealthBriefing({
      plan,
      nutrition7,
      nutrition28,
      sleep7,
      sleep28,
      bedtimeTarget: "23:30",
    });
    const sleep = briefing.reminders.find((r) => r.key === "early-sleep");
    expect(sleep?.windowLabel).toBe("22:00");
    expect(sleep?.hour).toBe(22);
  });

  it("近 7 天不足但 28 天达标时，仍可用四周基线触发提醒", () => {
    const nutrition7 = buildNutritionBaseline(nutritionDays(3, { kcal: 2000, proteinG: 50, entryCount: 3 }), {
      windowDays: 7,
      endDate: "2026-11-28",
    });
    const nutrition28 = buildNutritionBaseline(nutritionDays(18, { kcal: 2000, proteinG: 50, entryCount: 3 }), {
      windowDays: 28,
      endDate: "2026-11-28",
    });
    const sleep7 = buildSleepAssessment(sleepNights(3, { durationMin: 390 }), {
      windowDays: 7,
      endDate: "2026-11-28",
    });
    const sleep28 = buildSleepAssessment(sleepNights(18, { durationMin: 390 }), {
      windowDays: 28,
      endDate: "2026-11-28",
    });
    const briefing = buildHealthBriefing({ plan, nutrition7, nutrition28, sleep7, sleep28 });
    expect(briefing.reminders.map((r) => r.key)).toContain("protein");
    expect(briefing.reminders.map((r) => r.key)).toContain("early-sleep");
    expect(briefing.reminders.find((r) => r.key === "protein")?.evidence).toContain("近 28 天");

  });
  it("四周达标后，洞察与提醒统一使用四周口径（不被近 7 天掩盖）", () => {
    const lowDays = Array.from({ length: 18 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      kcal: 2000,
      proteinG: 50,
      carbsG: 240,
      fatG: 70,
      entryCount: 3,
    }));
    const goodWeek = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-11-${String(i + 22).padStart(2, "0")}`,
      kcal: 2400,
      proteinG: 105,
      carbsG: 300,
      fatG: 80,
      entryCount: 3,
    }));
    const nutrition7 = buildNutritionBaseline([...lowDays, ...goodWeek], {
      windowDays: 7,
      endDate: "2026-11-26",
    });
    const nutrition28 = buildNutritionBaseline([...lowDays, ...goodWeek], {
      windowDays: 28,
      endDate: "2026-11-26",
    });
    expect(nutrition7.avgProteinG).toBe(105);
    expect(nutrition28.meetsMinimum).toBe(true);

    const shortMonths = Array.from({ length: 18 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      durationMin: 390,
      efficiencyPct: 88,
      deepPct: 14,
      remPct: 20,
      awakeCount: 2,
      bedtimeOffsetMin: 30,
    }));
    const goodNights = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-11-${String(i + 22).padStart(2, "0")}`,
      durationMin: 450,
      efficiencyPct: 95,
      deepPct: 18,
      remPct: 22,
      awakeCount: 0,
      bedtimeOffsetMin: -30,
    }));
    const sleep7 = buildSleepAssessment([...shortMonths, ...goodNights], {
      windowDays: 7,
      endDate: "2026-11-26",
    });
    const sleep28 = buildSleepAssessment([...shortMonths, ...goodNights], {
      windowDays: 28,
      endDate: "2026-11-26",
    });
    expect(sleep7.flags.shortSleep).toBe(false);
    expect(sleep28.meetsMinimum).toBe(true);

    const briefing = buildHealthBriefing({ plan, nutrition7, nutrition28, sleep7, sleep28 });
    const protein = briefing.insights.find((i) => i.key === "protein-low");
    expect(protein).toBeTruthy();
    expect(protein?.body).toContain("近四周平均 62g");
    expect(protein?.evidence).toContain("近 28 天");
    expect(briefing.reminders.find((r) => r.key === "protein")?.evidence).toContain("近 28 天");
    expect(briefing.insights.find((i) => i.key === "sleep-short")).toBeTruthy();
    expect(briefing.reminders.map((r) => r.key)).toContain("early-sleep");
  });
  it("静默时段支持跨零点", () => {
    expect(inQuietHours(23, 30, "23:00", "07:00")).toBe(true);
    expect(inQuietHours(6, 59, "23:00", "07:00")).toBe(true);
    expect(inQuietHours(12, 0, "23:00", "07:00")).toBe(false);
    expect(
      reminderBlockedByQuietHours({ hour: 22, minute: 0 }, { quietStart: "22:00", quietEnd: "07:00" })
    ).toBe(true);
  });

  it("提醒时间跨天生成，且跳过已过去的今天", () => {
    const now = new Date(2026, 10, 28, 23, 0, 0);
    const times = nextReminderOccurrences({ hour: 22, minute: 0, active: true }, now, 3);
    expect(times).toHaveLength(3);
    expect(times[0].getDate()).toBe(29);
  });

  it("时间偏移与 HH:mm 互转", () => {
    expect(clockToBedtimeOffset("23:30")).toBe(-30);
    expect(clockToBedtimeOffset("00:30")).toBe(30);
    expect(bedtimeOffsetToClock(-30)).toBe("23:30");
    expect(bedtimeOffsetToClock(30)).toBe("00:30");
  });
});

