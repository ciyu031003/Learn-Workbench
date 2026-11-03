import { describe, expect, it } from "vitest";
import {
  comparePaperStats,
  computePaperResult,
  type PaperResultQuestion,
} from "./paper-result";

/** 408 套卷归因纯函数（P3-2B）单测：口径与 Web paper-answer-sheet.summarizeAnswers 对齐 */

function question(
  number: number,
  overrides: Partial<PaperResultQuestion> = {},
): PaperResultQuestion {
  return {
    number,
    points: 2,
    subject: { key: "ds", title: "数据结构" },
    knowledgePoints: [],
    ...overrides,
  };
}

describe("computePaperResult", () => {
  it("空输入全 0 且不返回共享数组", () => {
    const result = computePaperResult([]);
    expect(result).toEqual({
      score: 0,
      totalScore: 0,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      byPoint: [],
      bySubject: [],
    });
    // 空数组必须是新实例：调用方 push 不能污染下一次结果
    const again = computePaperResult([], { 1: "correct" });
    expect(again.byPoint).not.toBe(result.byPoint);
    expect(again).toEqual(result);
  });

  it("答对加分、答错不加分、综合题查看答案不计入任何计数、缺省为未答", () => {
    const questions = [
      question(1, { points: 2, knowledgePoints: [{ key: "kp-1", title: "线性表" }] }),
      question(2, { points: 4, knowledgePoints: [{ key: "kp-1", title: "线性表" }] }),
      question(3, {
        points: 10,
        subject: { key: "co", title: "计算机组成原理" },
        knowledgePoints: [{ key: "kp-2", title: "cache" }],
      }),
      question(4, { points: 6, knowledgePoints: [{ key: "kp-3", title: "栈与队列" }] }),
    ];
    const result = computePaperResult(questions, { 1: "correct", 2: "wrong", 3: "reviewed" });

    expect(result.totalScore).toBe(22);
    expect(result.score).toBe(2);
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(1);
    // 第 4 题没有作答记录 → 未答；第 3 题 reviewed 不算未答
    expect(result.unanswered).toBe(1);
    expect(result.byPoint.map((item) => item.key)).toEqual(["kp-1", "kp-2", "kp-3"]);
    expect(result.byPoint[0]).toMatchObject({ title: "线性表", wrong: 1, total: 2 });
    // 归因 total 覆盖全部题目（含 reviewed / 未答），wrong 只算答错
    expect(result.byPoint[1]).toEqual({ key: "kp-2", title: "cache", wrong: 0, total: 1 });
  });

  it("未作答单独统计，不混入 wrong", () => {
    const questions = [question(1), question(2), question(3)];
    const result = computePaperResult(questions, { 1: "wrong" });
    expect(result.wrong).toBe(1);
    expect(result.unanswered).toBe(2);
    expect(result.correct).toBe(0);
    expect(result.score).toBe(0);
  });

  it("同一道题的多个知识点 key 分别累计（同一 key 重复只算一次）", () => {
    const questions = [
      question(1, {
        knowledgePoints: [
          { key: "kp-a", title: "知识点 A" },
          { key: "kp-b", title: "知识点 B" },
          { key: "kp-a", title: "知识点 A" },
        ],
      }),
      question(2, {
        knowledgePoints: [
          { key: "kp-a", title: "知识点 A" },
          { key: "kp-c", title: "知识点 C" },
        ],
      }),
    ];
    const result = computePaperResult(questions, { 1: "wrong", 2: "correct" });

    expect(result.byPoint).toEqual([
      { key: "kp-a", title: "知识点 A", wrong: 1, total: 2 },
      { key: "kp-b", title: "知识点 B", wrong: 1, total: 1 },
      { key: "kp-c", title: "知识点 C", wrong: 0, total: 1 },
    ]);
  });

  it("按 wrong 降序、total 降序、key 升序稳定排序", () => {
    const answers: Record<number, "correct" | "wrong"> = {};
    const questions: PaperResultQuestion[] = [];
    let number = 1;
    const push = (key: string, answer?: "correct" | "wrong") => {
      questions.push(question(number, { knowledgePoints: [{ key, title: key.toUpperCase() }] }));
      if (answer) answers[number] = answer;
      number += 1;
    };
    // p-a: wrong 2 / total 2
    push("p-a", "wrong");
    push("p-a", "wrong");
    // p-b: wrong 1 / total 3
    push("p-b", "wrong");
    push("p-b", "correct");
    push("p-b");
    // p-c / p-d: 同为 wrong 1 / total 1，按 key 升序
    push("p-d", "wrong");
    push("p-c", "wrong");

    const result = computePaperResult(questions, answers);
    expect(result.byPoint.map((item) => item.key)).toEqual(["p-a", "p-b", "p-c", "p-d"]);

    // 直接钉住比较器：先 wrong、再 total、最后 key
    expect(
      comparePaperStats(
        { key: "b", title: "B", wrong: 1, total: 1 },
        { key: "a", title: "A", wrong: 1, total: 1 },
      ),
    ).toBeGreaterThan(0);
    expect(
      comparePaperStats(
        { key: "z", title: "Z", wrong: 3, total: 1 },
        { key: "a", title: "A", wrong: 1, total: 9 },
      ),
    ).toBeLessThan(0);
    expect(
      comparePaperStats(
        { key: "x", title: "X", wrong: 1, total: 1 },
        { key: "x", title: "X", wrong: 1, total: 1 },
      ),
    ).toBe(0);
  });

  it("科目统计按 key 归并，总分包含未答与综合题分值", () => {
    const questions = [
      question(1, { points: 2, subject: { key: "ds", title: "数据结构" } }),
      question(2, { points: 2, subject: { key: "ds", title: "数据结构" } }),
      question(3, { points: 3, subject: { key: "co", title: "计算机组成原理" } }),
      question(4, { points: 10, subject: { key: "co", title: "计算机组成原理" } }),
    ];
    const result = computePaperResult(questions, { 1: "correct", 2: "wrong", 3: "reviewed" });

    expect(result.totalScore).toBe(17);
    expect(result.score).toBe(2);
    expect(result.bySubject).toEqual([
      { key: "ds", title: "数据结构", wrong: 1, total: 2 },
      { key: "co", title: "计算机组成原理", wrong: 0, total: 2 },
    ]);
  });

  it("脏数据（负分 / NaN / 空白知识点 key）不污染结果", () => {
    const questions = [
      { number: 1, points: -4, subject: { key: "ds", title: "数据结构" }, knowledgePoints: [] },
      { number: 2, points: Number.NaN, subject: { key: "ds", title: "数据结构" }, knowledgePoints: [] },
      {
        number: 3,
        points: 5,
        subject: { key: "", title: "" },
        knowledgePoints: [{ key: "  ", title: "空白 key" }],
      },
    ];
    const result = computePaperResult(questions as unknown as PaperResultQuestion[], {
      1: "correct",
      2: "wrong",
    });
    expect(result.totalScore).toBe(5);
    expect(result.score).toBe(0);
    expect(result.correct).toBe(1);
    expect(result.byPoint).toEqual([]);
    expect(result.bySubject).toEqual([{ key: "ds", title: "数据结构", wrong: 1, total: 2 }]);
  });
});
