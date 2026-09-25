import { describe, it, expect } from "vitest";
import {
  buildStudyCardModel,
  humanDuration,
  studyDistribution,
  studyFlagsOf,
  FLAG_LIMIT,
  type StudyCardInput,
} from "./study-card-model";

const base: StudyCardInput = {
  todayMinutes: 50,
  todaySessions: 2,
  streak: 3,
  totalFocusDays: 12,
  last14: [
    { date: "2026-09-23", minutes: 25 },
    { date: "2026-09-24", minutes: 50 },
  ],
  weekMinutes: 240,
  now: new Date("2026-09-24T20:00:00"),
};

describe("humanDuration", () => {
  it("60 分钟以内给分钟，超过给小时（最多一位小数）", () => {
    expect(humanDuration(0)).toBe("0 分钟");
    expect(humanDuration(59)).toBe("59 分钟");
    expect(humanDuration(60)).toBe("1 小时");
    expect(humanDuration(95)).toBe("1.6 小时");
    expect(humanDuration(600)).toBe("10 小时");
  });
  it("负数与脏值归零", () => {
    expect(humanDuration(-5)).toBe("0 分钟");
    expect(humanDuration(Number.NaN)).toBe("0 分钟");
  });
});

describe("studyFlagsOf", () => {
  it("按优先级给徽章并截断到 4 枚", () => {
    const flags = studyFlagsOf({
      ...base,
      streak: 9,
      weekMinutes: 900,
      todayMinutes: 60,
      tasksDone: 3,
      tasksTotal: 3,
      habitsDone: 2,
      habitsScheduled: 2,
    });
    expect(flags[0]).toBe("连续 9 天");
    expect(flags).toContain("本周达标");
    expect(flags).toContain("深度专注");
    expect(flags).toContain("今日全清");
    // 第 5 枚（习惯全勤）被 FLAG_LIMIT 截断
    expect(flags).toHaveLength(FLAG_LIMIT);
    expect(flags).not.toContain("习惯全勤");
  });

  it("没有达标项时返回空数组", () => {
    // base.todayMinutes = 50 会触发「深度专注」，所以这里显式降到 45 以下
    expect(studyFlagsOf({ ...base, todayMinutes: 30 })).toEqual([]);
  });

  it("45 分钟即触发「深度专注」", () => {
    expect(studyFlagsOf({ ...base, todayMinutes: 45 })).toEqual(["深度专注"]);
  });

  it("任务全清要求总数 > 0（0/0 不算）", () => {
    expect(studyFlagsOf({ ...base, tasksDone: 0, tasksTotal: 0 })).not.toContain("今日全清");
    expect(studyFlagsOf({ ...base, tasksDone: 1, tasksTotal: 1 })).toContain("今日全清");
  });
});

describe("buildStudyCardModel", () => {
  it("把统计映射成左右两列 + 文案", () => {
    const m = buildStudyCardModel(base);
    expect(m.title).toBe("学习档案");
    expect(m.rowsLeft).toEqual([
      ["今日专注", "50 分钟"],
      ["今日次数", "2 次"],
      ["单次均时", "25 分"],
    ]);
    expect(m.rowsRight[0]).toEqual(["本周专注", "4 小时"]);
    expect(m.rowsRight[1]).toEqual(["任务完成", "—"]);
    expect(m.rowsRight[2]).toEqual(["习惯打卡", "无排期"]);
    expect(m.tagline).toBe("连续 3 天 · 累计 12 天");
    expect(m.collection).toContain("2026-09-24");
    expect(m.edition).toBe("NO.12");
    expect(m.technique).toBe("今日达成 33%");
  });

  it("空数据不崩，且文案给出起步引导", () => {
    const m = buildStudyCardModel({ ...base, todayMinutes: 0, todaySessions: 0, streak: 0, totalFocusDays: 0, last14: [] });
    expect(m.technique).toBe("从第一件事开始");
    expect(m.edition).toBe("NO.01");
    expect(m.rowsLeft[2]).toEqual(["单次均时", "—"]);
  });

  it("契约字段齐全（可直接喂参考卡）", () => {
    const m = buildStudyCardModel(base);
    expect(Object.keys(m.parameters).sort()).toEqual(
      ["backgroundDepth", "foil", "glow", "subjectDepth", "subjectScale"].sort()
    );
    expect(m.safeArea.offset).toHaveLength(2);
    expect(Array.isArray(m.flags)).toBe(true);
  });
});

describe("studyDistribution", () => {
  it("按最大值归一化", () => {
    expect(studyDistribution(base.last14)).toEqual([
      { date: "2026-09-23", ratio: 0.5 },
      { date: "2026-09-24", ratio: 1 },
    ]);
  });
  it("全 0 时不除零", () => {
    expect(studyDistribution([{ date: "2026-09-24", minutes: 0 }])).toEqual([{ date: "2026-09-24", ratio: 0 }]);
  });
});
