import { describe, it, expect } from "vitest";
import {
  buildSportsCardModel,
  computeSportsRecord,
  formatWinRate,
  sportGearTemplate,
  SPORT_GEAR_TEMPLATES,
} from "@learn-workbench/shared";

describe("computeSportsRecord", () => {
  it("算胜率并按「胜+负」兜底场次", () => {
    expect(computeSportsRecord({ matchesPlayed: 20, wins: 15, losses: 5 })).toEqual({ matches: 20, wins: 15, losses: 5, winRate: 75 });
    expect(computeSportsRecord({ wins: 6, losses: 4 })).toEqual({ matches: 10, wins: 6, losses: 4, winRate: 60 });
  });

  it("保留一位小数，无场次返回 null", () => {
    expect(computeSportsRecord({ matchesPlayed: 214, wins: 178, losses: 36 }).winRate).toBe(83.2);
    expect(computeSportsRecord({}).winRate).toBeNull();
    expect(computeSportsRecord({ wins: 1, losses: 2 }).winRate).toBe(33.3);
  });

  it("负数归零", () => {
    expect(computeSportsRecord({ matchesPlayed: -3, wins: -1, losses: -2 })).toEqual({ matches: 0, wins: 0, losses: 0, winRate: null });
  });
});

describe("formatWinRate", () => {
  it("一位小数百分比", () => {
    expect(formatWinRate(83.2)).toBe("83.2%");
    expect(formatWinRate(75)).toBe("75.0%");
    expect(formatWinRate(null)).toBe("—");
  });
});

describe("sportGearTemplate", () => {
  it("拍类运动带「球拍类型 / 球鞋类型」行", () => {
    expect(sportGearTemplate("badminton")).toContain("球拍类型");
    expect(sportGearTemplate("badminton")).toContain("球鞋类型");
    expect(sportGearTemplate("tennis")).toEqual(SPORT_GEAR_TEMPLATES.tennis);
  });

  it("未知运动回退到通用装备行", () => {
    expect(sportGearTemplate("curling")).toEqual(["球拍", "球鞋", "球线", "手胶"]);
  });
});

describe("buildSportsCardModel", () => {
  const model = buildSportsCardModel(
    {
      sportKey: "badminton",
      identity: "双打搭子",
      levelText: "业余 6 级",
      playStyle: "混双",
      handedness: "right",
      gear: [
        { label: "球拍型号", value: "VICTOR 龙牙之刃 II" },
        { label: "球拍类型", value: "进攻拍" },
        { label: "球鞋类型", value: "YONEX 65Z3" },
        { label: "拍线", value: "BG65" },
      ],
      highlights: [{ label: "城市联赛", value: "八强" }],
      matchesPlayed: 214,
      wins: 178,
      losses: 36,
      signatureMove: "疾风·劈杀",
    },
    { sportName: "羽毛球", index: 1, total: 3, year: 2026 }
  );

  it("标题/英文小标/典藏/编号与素材一致", () => {
    expect(model.title).toBe("羽毛球档案");
    expect(model.subtitle).toBe("BADMINTON ARCHIVE");
    expect(model.collection).toBe("2026 个人运动典藏");
    expect(model.edition).toBe("NO.001 / 003");
  });

  it("右侧栏就是战绩三项", () => {
    expect(model.rowsRight).toEqual([["总战绩", "214 场"], ["胜 / 负", "178 胜 / 36 负"], ["胜率", "83.2%"]]);
    expect(model.tagline).toBe("214 战 · 178 胜 · 胜率 83.2%");
  });

  it("左侧栏 = 等级 + 最多 3 行装备", () => {
    expect(model.rowsLeft[0]).toEqual(["等级", "业余 6 级"]);
    expect(model.rowsLeft[1]).toEqual(["球拍型号", "VICTOR 龙牙之刃 II"]);
    expect(model.rowsLeft[2]).toEqual(["球拍类型", "进攻拍"]);
    expect(model.rowsLeft[3]).toEqual(["球鞋类型", "YONEX 65Z3"]);
    expect(model.rowsLeft).toHaveLength(4);
  });

  it("徽章取公开成绩，最多 4 条", () => {
    expect(model.flags).toEqual(["城市联赛 八强"]);
  });
});

describe("buildSportsCardModel 兜底", () => {
  it("没有绝技/战绩时给出占位文案而不是空白卡面", () => {
    const m = buildSportsCardModel(
      { sportKey: "tennis", identity: null, levelText: null, playStyle: "单打", handedness: null, gear: [], highlights: [] },
      { sportName: "网球" }
    );
    expect(m.technique).toBe("单打");
    expect(m.rowsLeft[0]).toEqual(["等级", "未填写"]);
    expect(m.record.matches).toBe(0);
    expect(m.tagline).toBe("还没有战绩数据");
    expect(m.edition).toBe("NO.001 / 001");
  });
});
