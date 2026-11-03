/**
 * 408 套卷交卷归因（P3-2B）。
 *
 * 输入是「试卷题目 + 本次作答结果」，输出可直接用于总结页的错题分布，
 * 也是 `submitPaperAttempt` 上报服务端的载荷来源（见 lib/paper-history.ts）。
 *
 * 口径（与 Web 端 paper-answer-sheet 的 summarizeAnswers 保持一致）：
 * - 只有选择题会判对错；答对才加分（score 为客观题得分）。
 * - 综合应用题点「查看答案」记为 reviewed：不算答对、不算答错、也不算未答。
 * - 完全没有作答记录的题才计入 unanswered。
 * - 错题分布里 wrong 只累计判为「答错」的题；total 是该知识点 / 科目在本套卷中的题数
 *   （含未答与综合题，作为「这套卷里出现了多少道」的分母）。
 */

/** 单题作答结果：与套卷页的 results 字段一致 */
export type PaperAnswerKind = "correct" | "wrong" | "reviewed";

/** 归因只需要题目的这几项字段（Exam408Question 天然满足） */
export interface PaperResultQuestion {
  number: number;
  points: number;
  subject: { key: string; title: string };
  knowledgePoints: readonly { key: string; title: string }[];
}

/** 一个知识点 / 科目的错题统计行 */
export interface PaperStat {
  key: string;
  title: string;
  /** 判为答错的题数（未答、综合题不计入） */
  wrong: number;
  /** 该知识点 / 科目在本套卷中的题数 */
  total: number;
}

export interface PaperResult {
  /** 客观题得分（仅答对的选择题分值） */
  score: number;
  /** 全卷满分（所有题目分值之和） */
  totalScore: number;
  /** 答对题数 */
  correct: number;
  /** 答错题数 */
  wrong: number;
  /** 未作答题数（没有任何作答记录；综合题「查看答案」不算未答） */
  unanswered: number;
  /** 知识点错题分布（按 wrong 降序、total 降序、key 升序） */
  byPoint: PaperStat[];
  /** 科目错题分布（排序规则同 byPoint） */
  bySubject: PaperStat[];
}

const EMPTY_RESULT: PaperResult = {
  score: 0,
  totalScore: 0,
  correct: 0,
  wrong: 0,
  unanswered: 0,
  byPoint: [],
  bySubject: [],
};

/** 非负有限数归一：脏数据（NaN / 负分 / 字符串）一律按 0 处理 */
function safePoints(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

/** 累计一行统计：同一 key 多次出现时合并，title 取第一个非空值 */
function accumulate(
  table: Map<string, PaperStat>,
  key: string,
  title: string,
  wrong: boolean,
): void {
  const current = table.get(key);
  if (current) {
    current.total += 1;
    if (wrong) current.wrong += 1;
    if (!current.title && title) current.title = title;
    return;
  }
  table.set(key, {
    key,
    title: title || key,
    wrong: wrong ? 1 : 0,
    total: 1,
  });
}

/** 稳定排序：wrong 降序 → total 降序 → key 升序 */
export function comparePaperStats(left: PaperStat, right: PaperStat): number {
  if (left.wrong !== right.wrong) return right.wrong - left.wrong;
  if (left.total !== right.total) return right.total - left.total;
  if (left.key === right.key) return 0;
  return left.key < right.key ? -1 : 1;
}

/**
 * 计算一次套卷交卷的成绩与错题归因。
 *
 * @param questions 本套卷全部题目（顺序即试卷顺序）
 * @param answers 题号 → 作答结果；缺省表示未作答
 */
export function computePaperResult(
  questions: readonly PaperResultQuestion[],
  answers: Readonly<Record<number, PaperAnswerKind>> = {},
): PaperResult {
  if (!Array.isArray(questions) || questions.length === 0) {
    // 返回新对象，避免调用方误改共享的空结果
    return { ...EMPTY_RESULT, byPoint: [], bySubject: [] };
  }

  const byPoint = new Map<string, PaperStat>();
  const bySubject = new Map<string, PaperStat>();
  let score = 0;
  let totalScore = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  for (const question of questions) {
    if (!question || typeof question.number !== "number") continue;
    const points = safePoints(question.points);
    totalScore += points;

    const kind = answers[question.number];
    if (kind === "correct") {
      score += points;
      correct += 1;
    } else if (kind === "wrong") {
      wrong += 1;
    } else if (kind !== "reviewed") {
      // 没有任何作答记录（reviewed 表示综合题已查看参考答案，单独统计、不算未答）
      unanswered += 1;
    }

    // 同一道题可能挂多个知识点：每个 key 分别累计，同一道题里重复的 key 只算一次
    const seenPoints = new Set<string>();
    for (const point of Array.isArray(question.knowledgePoints) ? question.knowledgePoints : []) {
      const key = typeof point?.key === "string" ? point.key.trim() : "";
      if (!key || seenPoints.has(key)) continue;
      seenPoints.add(key);
      accumulate(byPoint, key, typeof point.title === "string" ? point.title.trim() : "", kind === "wrong");
    }

    const subject = question.subject;
    const subjectKey = typeof subject?.key === "string" ? subject.key.trim() : "";
    if (subjectKey) {
      accumulate(
        bySubject,
        subjectKey,
        typeof subject.title === "string" ? subject.title.trim() : "",
        kind === "wrong",
      );
    }
  }

  return {
    score,
    totalScore,
    correct,
    wrong,
    unanswered,
    byPoint: [...byPoint.values()].sort(comparePaperStats),
    bySubject: [...bySubject.values()].sort(comparePaperStats),
  };
}
