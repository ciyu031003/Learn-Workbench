import { describe, it, expect } from "vitest";
import { buildSportsCardModel } from "@learn-workbench/shared";
import {
  CARD_TEXT_HEIGHT,
  CARD_TEXT_WIDTH,
  cardTextLayout,
  hasHoloArt,
  holoAssetUrl,
} from "./holo-card-text";

const profile = {
  sportKey: "badminton",
  identity: "双打搭子",
  levelText: "业余 6 级",
  playStyle: "混双",
  handedness: "right" as const,
  gear: [{ label: "球拍型号", value: "VICTOR 龙牙之刃 II" }, { label: "球鞋类型", value: "YONEX 65Z3" }],
  highlights: [{ label: "城市联赛", value: "八强" }, { label: "高校杯", value: "季军" }],
  matchesPlayed: 214,
  wins: 178,
  losses: 36,
  signatureMove: "疾风·劈杀",
};

const model = buildSportsCardModel(profile, { sportName: "羽毛球", index: 1, total: 3, year: 2026 });

describe("cardTextLayout", () => {
  it("画布与源素材同尺寸（1728×2368）", () => {
    const layout = cardTextLayout(model);
    expect(CARD_TEXT_WIDTH).toBe(1728);
    expect(CARD_TEXT_HEIGHT).toBe(2368);
    expect(layout.width).toBe(CARD_TEXT_WIDTH);
    expect(layout.height).toBe(CARD_TEXT_HEIGHT);
  });

  it("标题/英文小标/典藏号/绝技/战绩都上了卡面", () => {
    const layout = cardTextLayout(model);
    const texts = layout.slots.map((s) => s.text);
    expect(texts).toContain("BADMINTON ARCHIVE");
    expect(texts).toContain("羽毛球档案");
    expect(texts).toContain("2026 个人运动典藏");
    expect(texts).toContain("运动员档案 · ATHLETE PROFILE");
    expect(texts).toContain("214 战 · 178 胜 · 胜率 83.2%");
    expect(texts).toContain("疾风·劈杀");
    expect(texts).toContain("NO.001 / 003");
    expect(texts).toContain("HOLOGRAPHIC");
  });

  it("装备与战绩分别落在左右两列，都在面板内", () => {
    const layout = cardTextLayout(model);
    // 夹具用的是老标签「球拍型号 / 球鞋类型」，卡面模型会归一到「球拍 / 球鞋」
    const left = layout.slots.filter((s) => s.text === "球拍" || s.text === "球鞋");
    const right = layout.slots.filter((s) => s.text === "总战绩");
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(1);
    for (const slot of [...left, ...right]) {
      expect(slot.x).toBeGreaterThan(layout.panel.x);
      expect(slot.x).toBeLessThan(layout.panel.x + layout.panel.w);
      expect(slot.y).toBeGreaterThan(layout.panel.y);
      expect(slot.y).toBeLessThan(layout.panel.y + layout.panel.h);
    }
  });

  it("面板高度随行数增长（1 行 < 3 行）", () => {
    const one = cardTextLayout(
      buildSportsCardModel({ ...profile, gear: [], highlights: [] }, { sportName: "羽毛球" })
    );
    const three = cardTextLayout(model);
    expect(three.panel.h).toBeGreaterThan(one.panel.h);
  });

  it("徽章最多 4 个", () => {
    const many = cardTextLayout(
      buildSportsCardModel(
        { ...profile, highlights: [1, 2, 3, 4, 5, 6].map((n) => ({ label: "赛事" + n, value: "冠军" })) },
        { sportName: "羽毛球" }
      )
    );
    expect(many.flags.length).toBe(4);
  });
});

describe("hasHoloArt / holoAssetUrl", () => {
  it("7 个球类项目有闪光卡素材，其他运动没有", () => {
    expect(hasHoloArt("badminton")).toBe(true);
    expect(hasHoloArt("soccer")).toBe(true);
    expect(hasHoloArt("table-tennis")).toBe(true);
    expect(hasHoloArt("run")).toBe(false);
  });

  it("素材路径按运动分目录，模型只有一份", () => {
    expect(holoAssetUrl("tennis", "subject")).toBe("/holo/tennis/subject.webp");
    expect(holoAssetUrl("tennis", "card.glb")).toBe("/holo/card.glb");
    expect(holoAssetUrl("tennis", "lineart", "/static/holo")).toBe("/static/holo/tennis/lineart.webp");
  });
});
