/**
 * 知识点状态五件套（组二 · 阶段 13 = V3 Phase E）。
 *
 * 「掌握一个知识点」不是一个布尔，而是五个可分别观察的状态：
 *   阅读（读过）→ 练习（做过题）→ 掌握（题基本答对）→ 复习（到期 / 有错题）→ 实践（收藏/待落地）
 *
 * 为什么拆开：把"浏览过"和"掌握"混成一个百分比，会让人误判进度（读了 3 篇却一题没做）。
 * 这里给的是**每个状态独立的判定**与可解释的输入，纯函数便于单测；数据组装在 API 侧。
 */

export const LEARNING_POINT_STATES = ["read", "practice", "mastery", "review", "apply"] as const;
export type LearningPointState = (typeof LEARNING_POINT_STATES)[number];

export const LEARNING_POINT_STATE_LABEL: Record<LearningPointState, string> = {
  read: "阅读",
  practice: "练习",
  mastery: "掌握",
  review: "复习",
  apply: "实践",
};

/** 判定「掌握」的默认正确率门槛（按该知识点已练题目的最近一次结果算）。 */
export const POINT_MASTERY_RATIO = 0.8;

export interface PointStateInput {
  /** 阅读进度 0-100；0 或未传 = 未读 */
  readProgress?: number;
  /** 该知识点每道题的「最近一次作答对错」；空 = 没练过 */
  latestCorrect?: boolean[];
  /** 是否有到期的复习卡（SM-2） */
  dueForReview?: boolean;
  /** 是否已收藏（当前作为「实践」的代理信号：标记"要动手做/待落地"） */
  favorite?: boolean;
  masteryRatio?: number;
}

export interface PointStateResult {
  read: boolean;
  practice: boolean;
  mastery: boolean;
  review: boolean;
  apply: boolean;
  /** 已练题目的最近一次正确率（0..1，未练=0），给界面解释"掌握"从哪来 */
  accuracy: number;
}

export function derivePointState(input: PointStateInput): PointStateResult {
  const threshold = input.masteryRatio ?? POINT_MASTERY_RATIO;
  const results = input.latestCorrect ?? [];
  const correct = results.filter(Boolean).length;
  const accuracy = results.length === 0 ? 0 : correct / results.length;
  const read = (input.readProgress ?? 0) > 0;
  const practice = results.length > 0;
  const mastery = practice && accuracy >= threshold;
  const hasWrong = results.some((isCorrect) => !isCorrect);
  const review = Boolean(input.dueForReview) || hasWrong;
  const apply = Boolean(input.favorite);
  return { read, practice, mastery, review, apply, accuracy };
}

/** 该知识点已经点亮了几个状态（0..5）——给「进度环/角标」用。 */
export function pointStateCount(state: PointStateResult): number {
  return LEARNING_POINT_STATES.filter((key) => state[key]).length;
}

/**
 * 「达成型」状态：read/practice/mastery/apply —— 这四个齐了就视为这个知识点学完了。
 * `review` 是**待办提示**（有错题或到期卡，需要回头复习），它不是"成就"，不计入完成判定。
 */
export const POINT_COMPLETE_STATES = ["read", "practice", "mastery", "apply"] as const satisfies readonly LearningPointState[];

export function isPointComplete(state: PointStateResult): boolean {
  return POINT_COMPLETE_STATES.every((key) => state[key]);
}

export type PointStatesByKey = Record<string, PointStateResult>;

/** 站点级汇总：每个状态各点亮了多少个知识点（+ 全点亮数）。 */
export function summarizePointStates(states: PointStatesByKey): {
  total: number;
  byState: Record<LearningPointState, number>;
  complete: number;
} {
  const byState: Record<LearningPointState, number> = { read: 0, practice: 0, mastery: 0, review: 0, apply: 0 };
  let complete = 0;
  const values = Object.values(states);
  for (const state of values) {
    for (const key of LEARNING_POINT_STATES) if (state[key]) byState[key] += 1;
    if (isPointComplete(state)) complete += 1;
  }
  return { total: values.length, byState, complete };
}
