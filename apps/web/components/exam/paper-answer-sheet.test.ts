import { describe, expect, it } from "vitest";
import type { Exam408Question } from "@/lib/exam-408";
import {
  buildAnswerSheet,
  clampIndex,
  collectYears,
  filterQuestions,
  resolveKeyboardIntent,
  stepIndex,
  summarizeAnswers,
} from "./paper-answer-sheet";

function makeQuestion(
  number: number,
  overrides: Partial<Pick<Exam408Question, "type" | "points" | "year">> = {},
): Exam408Question {
  return {
    key: `q-${number}`,
    id: String(number),
    year: overrides.year ?? 2023,
    number,
    type: overrides.type ?? "choice",
    subject: { key: "cn", title: "计算机网络" },
    points: overrides.points ?? 2,
    body: "",
    stem: `第 ${number} 题`,
    options: [
      { letter: "A", text: "甲" },
      { letter: "B", text: "乙" },
      { letter: "C", text: "丙" },
      { letter: "D", text: "丁" },
    ],
    answerText: "",
    answerLetter: "A",
    imageRefs: [],
    answerImageRefs: [],
    videoUrl: null,
    tags: [],
    knowledgePoints: [],
  };
}

describe("buildAnswerSheet（答题卡条目）", () => {
  it("未作答的题补 unanswered，已作答沿用结果，题序与分值不变", () => {
    const questions = [
      makeQuestion(1, { points: 2 }),
      makeQuestion(2, { points: 2, type: "comprehensive" }),
      makeQuestion(3, { points: 2 }),
    ];
    const entries = buildAnswerSheet(questions, { 1: "correct", 2: "reviewed" });
    expect(entries.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(entries.map((entry) => entry.status)).toEqual(["correct", "reviewed", "unanswered"]);
    expect(entries.map((entry) => entry.points)).toEqual([2, 2, 2]);
    expect(entries[1].type).toBe("comprehensive");
  });

  it("空卷返回空数组", () => {
    expect(buildAnswerSheet([], {})).toEqual([]);
  });
});

describe("summarizeAnswers（答题卡统计）", () => {
  const entries = buildAnswerSheet(
    [
      makeQuestion(1, { points: 2 }),
      makeQuestion(2, { points: 2 }),
      makeQuestion(3, { points: 2 }),
      makeQuestion(4, { points: 10, type: "comprehensive" }),
      makeQuestion(5, { points: 2 }),
    ],
    { 1: "correct", 2: "wrong", 3: "correct", 4: "reviewed" },
  );

  it("分类计数：已答 / 未答 / 答对 / 答错 / 已看答案", () => {
    const summary = summarizeAnswers(entries);
    expect(summary.total).toBe(5);
    expect(summary.answered).toBe(4);
    expect(summary.unanswered).toBe(1);
    expect(summary.correct).toBe(2);
    expect(summary.wrong).toBe(1);
    expect(summary.reviewed).toBe(1);
  });

  it("得分只累加答对的选择题，综合题已看答案不计分", () => {
    expect(summarizeAnswers(entries).score).toBe(4);
  });

  it("正确率按已判选择题计算并四舍五入", () => {
    const summary = summarizeAnswers(entries);
    expect(summary.judged).toBe(3);
    expect(summary.accuracy).toBe(67);
  });

  it("没有已判题时正确率为 0，空答题卡各项为 0", () => {
    const empty = summarizeAnswers([]);
    expect(empty).toMatchObject({ total: 0, answered: 0, unanswered: 0, score: 0, accuracy: 0, judged: 0 });
    const reviewedOnly = summarizeAnswers(buildAnswerSheet([makeQuestion(1)], { 1: "reviewed" }));
    expect(reviewedOnly.accuracy).toBe(0);
    expect(reviewedOnly.judged).toBe(0);
  });
});

describe("clampIndex / stepIndex（题号边界）", () => {
  it("夹在 [0, total-1]", () => {
    expect(clampIndex(-3, 10)).toBe(0);
    expect(clampIndex(0, 10)).toBe(0);
    expect(clampIndex(9, 10)).toBe(9);
    expect(clampIndex(99, 10)).toBe(9);
  });

  it("空卷返回 0，不产生 NaN 或负数", () => {
    expect(clampIndex(5, 0)).toBe(0);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });

  it("按步长前后移动并停在两端", () => {
    expect(stepIndex(0, 10, 1)).toBe(1);
    expect(stepIndex(0, 10, -1)).toBe(0);
    expect(stepIndex(9, 10, 1)).toBe(9);
  });
});

describe("resolveKeyboardIntent（键盘交互映射）", () => {
  const letters = ["A", "B", "C", "D"];

  it("← / → 切题", () => {
    expect(resolveKeyboardIntent("ArrowLeft", { optionLetters: letters, submitted: false })).toEqual({ kind: "previous" });
    expect(resolveKeyboardIntent("ArrowRight", { optionLetters: letters, submitted: false })).toEqual({ kind: "next" });
  });

  it("1–4 映射到选项字母", () => {
    expect(resolveKeyboardIntent("1", { optionLetters: letters, submitted: false })).toEqual({ kind: "select", letter: "A" });
    expect(resolveKeyboardIntent("4", { optionLetters: letters, submitted: false })).toEqual({ kind: "select", letter: "D" });
  });

  it("选项不足时数字键不生效（综合题没有选项）", () => {
    expect(resolveKeyboardIntent("2", { optionLetters: ["A"], submitted: false })).toEqual({ kind: "none" });
    expect(resolveKeyboardIntent("1", { optionLetters: [], submitted: false })).toEqual({ kind: "none" });
    expect(resolveKeyboardIntent("5", { optionLetters: letters, submitted: false })).toEqual({ kind: "none" });
  });

  it("Enter 提交，已提交后不再重复提交也不再接受选项", () => {
    expect(resolveKeyboardIntent("Enter", { optionLetters: letters, submitted: false })).toEqual({ kind: "submit" });
    expect(resolveKeyboardIntent("Enter", { optionLetters: letters, submitted: true })).toEqual({ kind: "none" });
    expect(resolveKeyboardIntent("2", { optionLetters: letters, submitted: true })).toEqual({ kind: "none" });
  });

  it("其它按键不产生动作（含 0 与字母键）", () => {
    for (const key of ["a", "0", " ", "Tab", "Escape"]) {
      expect(resolveKeyboardIntent(key, { optionLetters: letters, submitted: false })).toEqual({ kind: "none" });
    }
  });
});

describe("filterQuestions（速览筛选）", () => {
  const questions = [
    makeQuestion(1, { type: "choice", year: 2023 }),
    makeQuestion(2, { type: "choice", year: 2023 }),
    makeQuestion(3, { type: "comprehensive", year: 2023 }),
    makeQuestion(4, { type: "choice", year: 2022 }),
  ];

  it("全部条件返回原顺序", () => {
    expect(filterQuestions(questions, { type: "all", year: "all" }).map((q) => q.number)).toEqual([1, 2, 3, 4]);
  });

  it("按题型筛选", () => {
    expect(filterQuestions(questions, { type: "choice", year: "all" }).map((q) => q.number)).toEqual([1, 2, 4]);
    expect(filterQuestions(questions, { type: "comprehensive", year: "all" }).map((q) => q.number)).toEqual([3]);
  });

  it("按年份筛选，且题型与年份可叠加", () => {
    expect(filterQuestions(questions, { type: "all", year: 2022 }).map((q) => q.number)).toEqual([4]);
    expect(filterQuestions(questions, { type: "choice", year: 2023 }).map((q) => q.number)).toEqual([1, 2]);
  });

  it("没有匹配时返回空数组", () => {
    expect(filterQuestions(questions, { type: "comprehensive", year: 2022 })).toEqual([]);
  });

  it("不修改入参", () => {
    const snapshot = questions.map((q) => q.number);
    filterQuestions(questions, { type: "choice", year: 2023 });
    expect(questions.map((q) => q.number)).toEqual(snapshot);
  });
});

describe("collectYears（年份下拉）", () => {
  it("去重并按新到旧排序", () => {
    const years = collectYears([makeQuestion(1, { year: 2019 }), makeQuestion(2, { year: 2023 }), makeQuestion(3, { year: 2019 })]);
    expect(years).toEqual([2023, 2019]);
  });

  it("空卷返回空数组", () => {
    expect(collectYears([])).toEqual([]);
  });
});
