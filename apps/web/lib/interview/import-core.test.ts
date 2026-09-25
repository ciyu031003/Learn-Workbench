import { describe, it, expect } from "vitest";
import {
  chunkItems,
  externalKeyFor,
  normalizeQuestion,
  planImport,
  shouldRunInterviewCrawl,
  type ExistingQuestion,
  type InterviewImportItem,
} from "./import-core";

const item = (over: Partial<InterviewImportItem> = {}): InterviewImportItem => ({
  module: "Java",
  question: "什么是 JVM ？",
  answer: "JVM 是 Java 虚拟机……（足够长的答案）".repeat(3),
  sourceSite: "github:Snailclimb/JavaGuide",
  sourceUrl: "https://github.com/Snailclimb/JavaGuide/blob/main/docs/java/jvm.md",
  license: "Apache-2.0",
  ...over,
});

describe("normalizeQuestion（去重键的归一化口径）", () => {
  it("全角空格与半角空白等价", () => {
    expect(normalizeQuestion("什么是 JVM ？")).toBe(normalizeQuestion("什么是　JVM？"));
  });
  it("大小写与换行/制表符不影响结果", () => {
    expect(normalizeQuestion("What Is   a\nJVM?")).toBe(normalizeQuestion("what is a\tjvm?"));
  });
  it("空值与纯空白归一到空串", () => {
    expect(normalizeQuestion("")).toBe("");
    expect(normalizeQuestion("   \u3000 ")).toBe("");
    // @ts-expect-error 运行时容错：undefined 不该抛
    expect(normalizeQuestion(undefined)).toBe("");
  });
});

describe("externalKeyFor（去重键）", () => {
  it("同形于 054 迁移的 external_key：<sourceSite>#<16 位 sha1>", () => {
    const key = externalKeyFor("github:Snailclimb/JavaGuide", "什么是 JVM ？");
    expect(key).toMatch(/^github:Snailclimb\/JavaGuide#[0-9a-f]{16}$/);
  });
  it("空白差异不产生第二个键（这正是重复题的来源）", () => {
    expect(externalKeyFor("s", "什么是 JVM ？")).toBe(externalKeyFor("s", "什么是　JVM？"));
  });
  it("不同题 / 不同来源 → 不同键；sourceSite 缺失用 unknown 兜底", () => {
    expect(externalKeyFor("s", "A 是什么？")).not.toBe(externalKeyFor("s", "B 是什么？"));
    expect(externalKeyFor("s", "同一题？")).not.toBe(externalKeyFor("t", "同一题？"));
    expect(externalKeyFor(null, "题？")).toBe("unknown#" + externalKeyFor("unknown", "题？").split("#")[1]);
  });
  it("稳定可复现（同输入两次同结果）", () => {
    expect(externalKeyFor("s", "稳定？")).toBe(externalKeyFor("s", "稳定？"));
  });
});

describe("chunkItems（分块）", () => {
  it("按 size 切分且不丢条目", () => {
    const chunks = chunkItems([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("size<=0 或非法时按 1 处理，空数组 → 空结果", () => {
    expect(chunkItems([1, 2], 0)).toEqual([[1], [2]]);
    expect(chunkItems([1, 2], Number.NaN)).toEqual([[1], [2]]);
    expect(chunkItems([], 10)).toEqual([]);
  });
  it("size 大于总数时只有一块", () => {
    expect(chunkItems([1, 2, 3], 100)).toEqual([[1, 2, 3]]);
  });
});

describe("shouldRunInterviewCrawl（幂等判断）", () => {
  it("当天没有成功记录 → 应该跑", () => {
    expect(shouldRunInterviewCrawl([])).toBe(true);
  });
  it("当天已有成功记录 → 跳过（cron 补跑/重复触发空转）", () => {
    expect(shouldRunInterviewCrawl([{ id: 1 }])).toBe(false);
    expect(shouldRunInterviewCrawl([{ id: 1 }, { id: 2 }])).toBe(false);
  });
});

describe("planImport（去重编排）", () => {
  it("空库 → 全部 insert，并按来源算出键", () => {
    const plan = planImport([item()], []);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].action).toBe("insert");
    expect(plan.entries[0].key).toContain("github:Snailclimb/JavaGuide#");
    expect(plan.duplicateInPayload).toBe(0);
  });

  it("同一 payload 内重复题只留第一条", () => {
    const plan = planImport([item(), item({ question: "什么是　JVM？" })], []);
    expect(plan.entries).toHaveLength(1);
    expect(plan.duplicateInPayload).toBe(1);
  });

  it("库里已有同一道题（历史遗留的旧键）→ 更新那一行，不插新行", () => {
    const existing: ExistingQuestion[] = [
      { id: 42, externalKey: "github:Snailclimb/JavaGuide#deadbeefdeadbeef", question: "什么是 JVM ？" },
    ];
    const plan = planImport([item()], existing);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].action).toBe("update");
    expect(plan.entries[0].targetId).toBe(42);
  });

  it("键完全相同也走 update（等价，且能刷新答案/模块）", () => {
    const q = "什么是 JVM ？";
    const key = externalKeyFor("github:Snailclimb/JavaGuide", q);
    const plan = planImport([item()], [{ id: 7, externalKey: key, question: q }]);
    expect(plan.entries[0]).toMatchObject({ action: "update", targetId: 7 });
  });

  it("调用方显式传入的 externalKey 优先（兼容手工导入）", () => {
    const plan = planImport([item({ externalKey: "manual#abc" })], []);
    expect(plan.entries[0].key).toBe("manual#abc");
  });

  it("题目为空/纯空白的条目被丢弃", () => {
    const plan = planImport([item({ question: "   " }), item({ question: "" })], []);
    expect(plan.entries).toHaveLength(0);
  });
});
