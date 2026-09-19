import { describe, it, expect } from "vitest";
import {
  buildSportsCardModel,
  computeSportsRecord,
  formatMemberNo,
  formatWinRate,
  gearRowWantsImage,
  mergeGearWithTemplate,
  normalizeSportGear,
  sportGearTemplate,
  toSportsShare,
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
  it("羽毛球装备行 = 球拍 / 球鞋 / 羽毛球 / 拍线（型号与类型合并，磅数不占装备行）", () => {
    expect(sportGearTemplate("badminton")).toEqual(["球拍", "球鞋", "羽毛球", "拍线"]);
    expect(sportGearTemplate("badminton")).not.toContain("球拍类型");
    expect(sportGearTemplate("badminton")).not.toContain("球拍型号");
    expect(sportGearTemplate("badminton")).not.toContain("磅数");
    expect(sportGearTemplate("tennis")).toEqual(SPORT_GEAR_TEMPLATES.tennis);
  });

  it("未知运动回退到通用装备行", () => {
    expect(sportGearTemplate("curling")).toEqual(["球拍", "球鞋", "球线", "手胶"]);
  });
});

describe("gearRowWantsImage", () => {
  it("只有球拍 / 球鞋 / 比赛用球配图", () => {
    expect(gearRowWantsImage("球拍")).toBe(true);
    expect(gearRowWantsImage("球鞋")).toBe(true);
    expect(gearRowWantsImage("羽毛球")).toBe(true);
    expect(gearRowWantsImage("网球")).toBe(true);
    expect(gearRowWantsImage("比赛用球")).toBe(true);
    expect(gearRowWantsImage("拍线")).toBe(false);
    expect(gearRowWantsImage("手胶")).toBe(false);
    expect(gearRowWantsImage("磅数")).toBe(false);
    expect(gearRowWantsImage("球衣")).toBe(false);
    expect(gearRowWantsImage("位置")).toBe(false);
  });
});

describe("toSportsShare", () => {
  it("装备图开关随档案带出（默认关），且不含任何身体数据", () => {
    const base = {
      sportKey: "badminton",
      identity: "双打搭子",
      levelText: "中羽 1 级",
      handedness: "right" as const,
      playStyle: "混双",
      photoUrl: null,
      gear: [{ label: "球拍", value: "雷霆80", imageUrl: "/uploads/u/a.webp" }],
      highlights: [],
      matchesPlayed: 20,
      wins: 15,
      losses: 5,
    };
    expect(toSportsShare(base, "羽毛球", null).showGearImages).toBe(false);
    expect(toSportsShare({ ...base, showGearImages: true }, "羽毛球", null).showGearImages).toBe(true);
    const share = toSportsShare({ ...base, showGearImages: true }, "羽毛球", "张三");
    for (const forbidden of ["weightKg", "heightCm", "birthYear", "shoeSize", "tensionLbs"]) {
      expect(share).not.toHaveProperty(forbidden);
    }
  });
});

describe("normalizeSportGear / mergeGearWithTemplate", () => {
  it("「球拍型号 + 球拍类型」合并成一行，图片保留、值拼在一起", () => {
    const { gear } = normalizeSportGear([
      { label: "球拍型号", value: "VICTOR 龙牙之刃 II", imageUrl: "/uploads/u/racket.webp" },
      { label: "球拍类型", value: "进攻拍" },
      { label: "球鞋类型", value: "YONEX 65Z3" },
    ]);
    expect(gear).toEqual([
      { label: "球拍", value: "VICTOR 龙牙之刃 II · 进攻拍", imageUrl: "/uploads/u/racket.webp" },
      { label: "球鞋", value: "YONEX 65Z3", imageUrl: null },
    ]);
  });

  it("「磅数」装备行抽成数值，不再留在装备里", () => {
    const { gear, tensionLbs } = normalizeSportGear([
      { label: "球拍", value: "YONEX 100ZZ" },
      { label: "磅数", value: "27.5" },
    ]);
    expect(gear).toEqual([{ label: "球拍", value: "YONEX 100ZZ", imageUrl: null }]);
    expect(tensionLbs).toBe(27.5);
  });

  it("按现模板排序补全，自定义行留在末尾", () => {
    const { gear } = mergeGearWithTemplate("badminton", [
      { label: "拍线", value: "BG65" },
      { label: "球拍型号", value: "YONEX 100ZZ" },
      { label: "自定义", value: "x" },
    ]);
    expect(gear.map((g) => g.label)).toEqual(["球拍", "球鞋", "羽毛球", "拍线", "自定义"]);
    expect(gear[0].value).toBe("YONEX 100ZZ");
    expect(gear[1].value).toBe("");
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

  it("左侧栏 = 等级 + 最多 3 行装备（老标签在卡面已归一合并）", () => {
    expect(model.rowsLeft[0]).toEqual(["等级", "业余 6 级"]);
    expect(model.rowsLeft[1]).toEqual(["球拍", "VICTOR 龙牙之刃 II · 进攻拍"]);
    expect(model.rowsLeft[2]).toEqual(["球鞋", "YONEX 65Z3"]);
    expect(model.rowsLeft[3]).toEqual(["拍线", "BG65"]);
    expect(model.rowsLeft).toHaveLength(4);
  });

  it("徽章取公开成绩，最多 4 条", () => {
    expect(model.flags).toEqual(["城市联赛 八强"]);
  });

  it("主荣誉 = 第一条公开成绩（卡面放大展示），其余进 honors", () => {
    expect(model.mainHonor).toEqual({ title: "城市联赛", detail: "八强" });
    expect(model.honors).toEqual([]);
    const many = buildSportsCardModel(
      {
        sportKey: "badminton",
        identity: null,
        levelText: "业余 6 级",
        playStyle: null,
        handedness: "right",
        gear: [],
        highlights: [{ label: "林丹杯", value: "亚军" }, { label: "高校杯", value: "季军" }, { label: "城市联赛", value: "八强" }, { label: "俱乐部赛", value: "4 冠" }],
      },
      { sportName: "羽毛球" }
    );
    expect(many.mainHonor).toEqual({ title: "林丹杯", detail: "亚军" });
    expect(many.honors).toEqual([{ title: "高校杯", detail: "季军" }, { title: "城市联赛", detail: "八强" }]);
  });

  it("没有公开成绩时主荣誉为空（卡面走占位）", () => {
    const empty = buildSportsCardModel(
      { sportKey: "badminton", identity: null, levelText: null, playStyle: null, handedness: null, gear: [], highlights: [] },
      { sportName: "羽毛球" }
    );
    expect(empty.mainHonor).toBeNull();
    expect(empty.honors).toEqual([]);
  });

  it("档案编号由 id 派生（BN + 6 位），缺省 BN000000", () => {
    expect(formatMemberNo(7)).toBe("BN000007");
    expect(formatMemberNo(21288)).toBe("BN021288");
    expect(formatMemberNo(null)).toBe("BN000000");
    const withNo = buildSportsCardModel(
      { sportKey: "badminton", identity: null, levelText: null, playStyle: null, handedness: null, gear: [], highlights: [] },
      { sportName: "羽毛球", memberNo: "BN021288" }
    );
    expect(withNo.memberNo).toBe("BN021288");
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
