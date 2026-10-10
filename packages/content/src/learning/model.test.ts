import { describe, expect, it } from "vitest";
import { learningTracks } from "./index";
import {
  buildKnowledgeModel,
  estimateReadingMinutes,
  gradeKnowledgeTopic,
  knowledgeContentFingerprint,
  knowledgePointKeyOf,
  QUALITY_LEVELS,
  type KnowledgePointRecord,
} from "./model";
import type { LearningTopic } from "./types";

const model = buildKnowledgeModel(learningTracks);

const fullTopic: LearningTopic = {
  key: "demo",
  title: "演示知识点",
  summary: "演示摘要",
  concepts: ["概念"],
  principles: ["原理"],
  applications: ["应用"],
  pitfalls: ["坑"],
  method: "方法",
  exercise: "练习",
  checkpoint: "自测",
  lesson: {
    overview: ["总览"],
    mechanism: ["机制"],
    example: { title: "例", language: "python", code: "print(1)", explanation: "说明" },
    practiceSteps: ["步骤"],
    masteryChecklist: ["清单"],
  },
};

describe("知识点稳定 ID", () => {
  it("三段拼装，含空格做归一", () => {
    expect(knowledgePointKeyOf({ trackSlug: "python", stageKey: "basics", topicKey: "syntax" })).toBe(
      "python/basics/syntax"
    );
    expect(knowledgePointKeyOf({ trackSlug: " a ", stageKey: "b", topicKey: "c" })).toBe("a/b/c");
  });

  it("模型内知识点 ID 全局唯一（构建期即校验不变量）", () => {
    const keys = model.points.map((point) => point.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(model.points.length).toBeGreaterThan(0);
  });
});

describe("质量分级", () => {
  it("模板全齐 + 2 题 + 许可已知 → L4", () => {
    expect(gradeKnowledgeTopic(fullTopic, { linkedQuestions: 2, licenseKnown: true })).toEqual({
      level: "L4",
      missing: [],
    });
  });

  it("缺讲解 → L2；概念层不足 → L1；连摘要都缺 → L0", () => {
    const { lesson: _lesson, ...noLesson } = fullTopic;
    expect(
      gradeKnowledgeTopic(noLesson as LearningTopic, { linkedQuestions: 2, licenseKnown: true }).level
    ).toBe("L2");

    const thin: LearningTopic = { ...noLesson, concepts: [], principles: [], applications: [], pitfalls: [] } as LearningTopic;
    expect(gradeKnowledgeTopic(thin, { linkedQuestions: 0, licenseKnown: false }).level).toBe("L1");
    expect(gradeKnowledgeTopic({ ...fullTopic, summary: "" }, { linkedQuestions: 2, licenseKnown: true }).level).toBe(
      "L0"
    );
  });

  it("有讲解但有缺项（题不足 / 许可未知）→ L3，并列出缺什么", () => {
    const result = gradeKnowledgeTopic(fullTopic, { linkedQuestions: 1, licenseKnown: false });
    expect(result.level).toBe("L3");
    expect(result.missing).toContain("questions>=2");
    expect(result.missing).toContain("license");
  });

  it("等级只可能是 L0–L4（口径与 UI 共用）", () => {
    for (const point of model.points) {
      expect(QUALITY_LEVELS).toContain(point.qualityLevel);
    }
  });
});

describe("阅读时长与指纹", () => {
  it("阅读时长夹在 [3, 60] 分钟", () => {
    for (const point of model.points) {
      expect(point.estimatedMinutes).toBeGreaterThanOrEqual(3);
      expect(point.estimatedMinutes).toBeLessThanOrEqual(60);
    }
    expect(estimateReadingMinutes(fullTopic)).toBeGreaterThanOrEqual(3);
  });

  it("指纹对同一内容稳定、对内容变化敏感", () => {
    expect(knowledgeContentFingerprint(fullTopic)).toBe(knowledgeContentFingerprint({ ...fullTopic }));
    expect(knowledgeContentFingerprint(fullTopic)).not.toBe(
      knowledgeContentFingerprint({ ...fullTopic, summary: "改过的摘要" })
    );
    expect(knowledgeContentFingerprint(fullTopic)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("关系与题关联", () => {
  it("next 边数量 = 同课程知识点数 - 课程数（每条线首尾不相连）", () => {
    const nextEdges = model.relations.filter((relation) => relation.kind === "next");
    expect(nextEdges.length).toBe(model.stats.points - model.stats.tracks);
  });

  it("related 只在同一阶段内，且不含相邻对", () => {
    const pointByKey = new Map(model.points.map((point) => [point.key, point]));
    for (const relation of model.relations) {
      if (relation.kind !== "related") continue;
      const from = pointByKey.get(relation.fromKey)!;
      const to = pointByKey.get(relation.toKey)!;
      expect(from.stageKey).toBe(to.stageKey);
      expect(Math.abs(from.topicOrder - to.topicOrder)).toBeGreaterThan(1);
    }
  });

  it("前置边 = 阶段数 - 课程数（每阶段首个知识点挂上一阶段末个）", () => {
    expect(model.prerequisites.length).toBe(model.stats.stages - model.stats.tracks);
    for (const edge of model.prerequisites) {
      expect(edge.knowledgePointKey).not.toBe(edge.prerequisiteKey);
      expect(edge.relationSource).toBe("derived");
    }
  });

  it("每道题要么关联到知识点、要么进待分类清单（不丢题、不重复）", () => {
    expect(model.stats.linkedQuestions + model.stats.unlinkedQuestions).toBe(model.stats.questions);
    const linked = new Set(model.questionLinks.map((link) => link.questionKey));
    expect(linked.size).toBe(model.questionLinks.length);
    expect(model.unlinkedQuestionKeys.every((key) => !linked.has(key))).toBe(true);
  });

  it("关联来源只有 explicit / stage-fallback 两种", () => {
    for (const link of model.questionLinks) {
      expect(["explicit", "stage-fallback"]).toContain(link.linkSource);
    }
  });
});

describe("内容库真实统计（写入 ERD / 看板的数字来源）", () => {
  it("产出可复算的统计并打印", () => {
    console.log("[learning-model]", JSON.stringify(model.stats));
    console.log(
      "[learning-model] L0 知识点：",
      model.points.filter((point) => point.qualityLevel === "L0").map((point) => point.key)
    );
    expect(model.stats.points).toBeGreaterThan(0);
    expect(model.stats.questions).toBeGreaterThan(0);
    expect(model.stats.byQuality.L0).toBe(0);
  });

  it("每个知识点都带难度/顺序/来源/指纹（入库必需字段不为空）", () => {
    for (const point of model.points as KnowledgePointRecord[]) {
      expect(point.key.length).toBeGreaterThan(0);
      expect(point.title.trim().length).toBeGreaterThan(0);
      expect(["easy", "medium", "hard"]).toContain(point.difficulty);
      expect(point.sortOrder).toBeGreaterThanOrEqual(0);
      expect(point.sourceKey).toBeTruthy();
      expect(point.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});
