import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/content/learning-repo", () => ({ invalidateLearningTracksCache: vi.fn() }));
import { normalizeQuestionPatch, normalizeTopicPatch, validateQuestion } from "./content-editor";

const base = {
  type: "single",
  status: "published",
  stem: "题干",
  explanation: "解析",
  options: [
    { key: "A", text: "甲" }, { key: "B", text: "乙" },
    { key: "C", text: "丙" }, { key: "D", text: "丁" },
  ],
  answer: ["A"],
  difficulty: "easy",
  level: "入门",
  tags: ["标签"],
};

describe("validateQuestion（按合并后的整行校验）", () => {
  it("接受合法单选题", () => {
    expect(validateQuestion(base)).toEqual({ ok: true });
  });

  it("答案不在选项里 → 拒绝", () => {
    expect(validateQuestion({ ...base, answer: ["Z"] })).toMatchObject({ ok: false });
  });

  it("选项 key 重复 → 拒绝", () => {
    const options = [...base.options.slice(0, 3), { key: "A", text: "重复" }];
    expect(validateQuestion({ ...base, options })).toMatchObject({ ok: false });
  });

  it("单选/判断只能有一个正确答案", () => {
    expect(validateQuestion({ ...base, answer: ["A", "B"] })).toMatchObject({ ok: false });
  });

  it("判断题必须正好两个选项", () => {
    expect(validateQuestion({ ...base, type: "judge" })).toMatchObject({ ok: false });
    expect(validateQuestion({ ...base, type: "judge", options: [{ key: "A", text: "正确" }, { key: "B", text: "错误" }] })).toEqual({ ok: true });
  });

  it("已发布题不能没有解析", () => {
    expect(validateQuestion({ ...base, explanation: "   " })).toMatchObject({ ok: false });
    expect(validateQuestion({ ...base, explanation: "  ", status: "draft" })).toEqual({ ok: true });
  });

  it("非法难度/分级/题型/状态都被拒绝", () => {
    expect(validateQuestion({ ...base, difficulty: "very-hard" })).toMatchObject({ ok: false });
    expect(validateQuestion({ ...base, level: "大师" })).toMatchObject({ ok: false });
    expect(validateQuestion({ ...base, type: "multi" })).toMatchObject({ ok: false });
    expect(validateQuestion({ ...base, status: "deleted" })).toMatchObject({ ok: false });
  });

  it("选项少于 2 个 → 拒绝", () => {
    expect(validateQuestion({ ...base, options: [{ key: "A", text: "甲" }], answer: ["A"] })).toMatchObject({ ok: false });
  });
});

describe("normalizeQuestionPatch（字段白名单）", () => {
  it("拒绝未声明字段（防越权写内部列）", () => {
    expect(normalizeQuestionPatch({ sort_order: 1 })).toMatchObject({ ok: false });
    expect(normalizeQuestionPatch({ fingerprint: "x" })).toMatchObject({ ok: false });
    expect(normalizeQuestionPatch({ key: "other" })).toMatchObject({ ok: false });
  });

  it("非对象 → 拒绝", () => {
    expect(normalizeQuestionPatch(null)).toMatchObject({ ok: false });
    expect(normalizeQuestionPatch("x")).toMatchObject({ ok: false });
  });

  it("题干去空白并限长", () => {
    expect(normalizeQuestionPatch({ stem: "  新题干  " })).toEqual({ ok: true, patch: { stem: "新题干" } });
    expect(normalizeQuestionPatch({ stem: "" })).toMatchObject({ ok: false });
    expect(normalizeQuestionPatch({ stem: "x".repeat(2001) })).toMatchObject({ ok: false });
  });

  it("level 空串归一为 null，tags 过滤空串", () => {
    expect(normalizeQuestionPatch({ level: "" })).toEqual({ ok: true, patch: { level: null } });
    expect(normalizeQuestionPatch({ tags: ["a", "  ", "b"] })).toEqual({ ok: true, patch: { tags: ["a", "b"] } });
  });
});

describe("normalizeTopicPatch（字段白名单）", () => {
  it("拒绝未声明字段", () => {
    expect(normalizeTopicPatch({ track_slug: "java" })).toMatchObject({ ok: false });
    expect(normalizeTopicPatch({ stage_key: "x" })).toMatchObject({ ok: false });
  });

  it("列表字段必须是字符串数组", () => {
    expect(normalizeTopicPatch({ concepts: [1, 2] })).toMatchObject({ ok: false });
    expect(normalizeTopicPatch({ concepts: ["a", "b"] })).toEqual({ ok: true, patch: { concepts: ["a", "b"] } });
  });

  it("lesson 只接受对象或 null", () => {
    expect(normalizeTopicPatch({ lesson: [] })).toMatchObject({ ok: false });
    expect(normalizeTopicPatch({ lesson: null })).toEqual({ ok: true, patch: { lesson: null } });
    expect(normalizeTopicPatch({ lesson: { overview: ["x"] } })).toEqual({ ok: true, patch: { lesson: { overview: ["x"] } } });
  });

  it("status 只接受四种合法值", () => {
    expect(normalizeTopicPatch({ status: "published" })).toEqual({ ok: true, patch: { status: "published" } });
    expect(normalizeTopicPatch({ status: "deleted" })).toMatchObject({ ok: false });
  });
});
