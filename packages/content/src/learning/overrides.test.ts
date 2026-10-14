import { describe, expect, it } from "vitest";
import { applyContentOverrides, hasContentOverrides } from "./overrides";
import { learningTracks } from "./index";

const EMPTY = { questionOverrides: {}, topicOverrides: {} };
const track = learningTracks[0];
const question = track.questions[0];
const topic = track.stages[0].topics[0];

describe("内容覆盖（数据库 → 内容包 回写）", () => {
  it("没有覆盖时原对象直接返回（零开销）", () => {
    expect(hasContentOverrides(EMPTY)).toBe(false);
    expect(applyContentOverrides(track, EMPTY)).toBe(track);
  });

  it("题目覆盖按 key 命中，未命中的题保持原值", () => {
    const out = applyContentOverrides(track, {
      ...EMPTY,
      questionOverrides: {
        [question.key]: {
          stem: "覆盖后的题干",
          options: [{ key: "A", text: "甲" }, { key: "B", text: "乙" }],
          answer: ["A"],
          explanation: "覆盖后的解析",
          tags: ["覆盖"],
          difficulty: "hard",
          level: "综合",
          type: "single",
        },
      },
    });
    const hit = out.questions.find((item) => item.key === question.key);
    expect(hit?.stem).toBe("覆盖后的题干");
    expect(hit?.difficulty).toBe("hard");
    expect(hit?.level).toBe("综合");
    const other = out.questions.find((item) => item.key !== question.key);
    expect(other).toBeDefined();
    expect(out.questions.length).toBe(track.questions.length);
  });

  it("level 为 null 时归一为 undefined（保持 LearningQuestion 口径）", () => {
    const out = applyContentOverrides(track, {
      ...EMPTY,
      questionOverrides: {
        [question.key]: {
          stem: "s", options: [{ key: "A", text: "甲" }], answer: ["A"],
          explanation: "e", tags: [], difficulty: "easy", level: null, type: "single",
        },
      },
    });
    expect(out.questions.find((item) => item.key === question.key)?.level).toBeUndefined();
  });

  it("知识点覆盖按 <trackSlug>::<topicKey> 命中", () => {
    const out = applyContentOverrides(track, {
      ...EMPTY,
      topicOverrides: {
        [track.slug + "::" + topic.key]: {
          title: "覆盖标题", summary: "覆盖摘要",
          concepts: ["c"], principles: ["p"], applications: ["a"], pitfalls: ["f"],
          method: "m", exercise: "e", checkpoint: "k", lesson: null,
        },
      },
    });
    const hit = out.stages[0].topics.find((item) => item.key === topic.key);
    expect(hit?.title).toBe("覆盖标题");
    expect(hit?.concepts).toEqual(["c"]);
    expect(hit?.lesson).toBeUndefined();
    expect(out.stages.length).toBe(track.stages.length);
  });

  it("覆盖不改动题目/知识点数量与阶段结构", () => {
    const out = applyContentOverrides(track, {
      ...EMPTY,
      topicOverrides: {
        [track.slug + "::" + topic.key]: {
          title: "t", summary: "s", concepts: [], principles: [], applications: [], pitfalls: [],
          method: "", exercise: "", checkpoint: "", lesson: null,
        },
      },
    });
    const topicsBefore = track.stages.reduce((n, stage) => n + stage.topics.length, 0);
    const topicsAfter = out.stages.reduce((n, stage) => n + stage.topics.length, 0);
    expect(topicsAfter).toBe(topicsBefore);
    expect(out.questions.length).toBe(track.questions.length);
  });
});
