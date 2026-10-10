import { describe, expect, it } from "vitest";
import { learningTracks } from "@learn-workbench/content";
import {
  filterLearningQuestions,
  flattenLearningQuestions,
  learningQuestionFacets,
} from "./learning-questions";

const items = flattenLearningQuestions();
const totalQuestions = learningTracks.reduce((total, track) => total + track.questions.length, 0);

describe("flattenLearningQuestions", () => {
  it("拍平全部题目且一条不丢", () => {
    expect(items).toHaveLength(totalQuestions);
    expect(new Set(items.map((item) => item.key)).size).toBe(totalQuestions);
  });

  it("每题都能定位到课程/阶段/知识点/来源（双向跳转的前提）", () => {
    for (const item of items) {
      expect(item.trackSlug, item.key).not.toBe("");
      expect(item.trackTitle, item.key).not.toBe("");
      expect(item.stageKey, item.key).not.toBe("");
      expect(item.topicKey, `${item.key} 缺 topicKey`).not.toBeNull();
      expect(item.topicTitle, `${item.key} 缺 topicTitle`).not.toBeNull();
      expect(item.sourceName, `${item.key} 来源未解析`).not.toBeNull();
      expect(item.options.length, item.key).toBeGreaterThanOrEqual(2);
      expect(item.answer.length, item.key).toBeGreaterThan(0);
    }
  });
});

describe("filterLearningQuestions", () => {
  const python = items.filter((item) => item.trackSlug === "python");

  it("按课程筛选", () => {
    const filtered = filterLearningQuestions(items, { track: "python" });
    expect(filtered.length).toBe(python.length);
    expect(filtered.every((item) => item.trackSlug === "python")).toBe(true);
  });

  it("按知识点筛选只留该知识点的题", () => {
    const sample = python[0];
    const filtered = filterLearningQuestions(items, { topic: sample.topicKey });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((item) => item.topicKey === sample.topicKey)).toBe(true);
  });

  it("按类型与难度筛选", () => {
    const judge = filterLearningQuestions(items, { type: "judge" });
    expect(judge.length).toBeGreaterThan(0);
    expect(judge.every((item) => item.type === "judge")).toBe(true);

    const hard = filterLearningQuestions(items, { difficulty: "hard" });
    expect(hard.every((item) => item.difficulty === "hard")).toBe(true);
  });

  it("按标签与来源筛选", () => {
    const tag = python[0].tags[0];
    const byTag = filterLearningQuestions(items, { tag });
    expect(byTag.length).toBeGreaterThan(0);
    expect(byTag.every((item) => item.tags.includes(tag))).toBe(true);

    const source = filterLearningQuestions(items, { source: python[0].sourceKey });
    expect(source.length).toBeGreaterThan(0);
    expect(source.every((item) => item.sourceKey === python[0].sourceKey)).toBe(true);
  });

  it("关键词命中题干，且不搜答案（避免筛选时泄漏答案）", () => {
    const item = items.find((candidate) => candidate.explanation.length > 0)!;
    // 取题干里出现的一个较长片段作为关键词
    const needle = item.stem.slice(0, Math.min(6, item.stem.length));
    const filtered = filterLearningQuestions(items, { keyword: needle });
    expect(filtered.some((candidate) => candidate.key === item.key)).toBe(true);
    // 仅存在于解释里的词不应把题目筛出来（解释不参与匹配）
    const explanationOnly = `__${item.explanation}__`;
    expect(filterLearningQuestions(items, { keyword: explanationOnly })).toHaveLength(0);
  });

  it("多条件叠加是「与」关系", () => {
    const filtered = filterLearningQuestions(items, { track: "python", type: "single", difficulty: "easy" });
    expect(
      filtered.every((item) => item.trackSlug === "python" && item.type === "single" && item.difficulty === "easy")
    ).toBe(true);
  });
});

describe("learningQuestionFacets", () => {
  it("维度计数自洽：课程题数之和等于总数", () => {
    const facets = learningQuestionFacets(items);
    expect(facets.tracks.reduce((total, facet) => total + facet.count, 0)).toBe(totalQuestions);
    expect(facets.types.reduce((total, facet) => total + facet.count, 0)).toBe(totalQuestions);
    expect(facets.difficulties.reduce((total, facet) => total + facet.count, 0)).toBe(totalQuestions);
    expect(facets.tracks.find((facet) => facet.key === "python")?.label).toBe("Python");
  });

  it("课程 facet 覆盖内容包全部课程", () => {
    const facets = learningQuestionFacets(items);
    expect(facets.tracks.map((facet) => facet.key).sort()).toEqual(
      learningTracks.map((track) => track.slug).sort()
    );
  });
});
