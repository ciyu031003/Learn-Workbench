/**
 * 数据库 → 内容包 回写（**自动生成，勿手改**）。
 *
 * 由 `node scripts/export-content-from-db.mjs` 生成：把数据库里
 * `manually_edited_at IS NOT NULL`（后台 /settings/content 改过）的题目与知识点
 * 导出成 overrides，内容包在 `expandLearningTrack` 之后应用它们。
 *
 * 这样做的意义：后台改的内容不会只活在数据库里 —— 导出后进 git，
 * 既拿到版本化与可回滚，又让「内容包 → 库」的同步不会因为分叉而互相覆盖。
 */
import type {
  LearningDifficulty,
  LearningLevel,
  LearningQuestionOption,
  LearningQuestionType,
  LearningTopicLesson,
} from "./types";

export interface QuestionOverrideRow {
  stem: string;
  options: LearningQuestionOption[];
  answer: string[];
  explanation: string;
  tags: string[];
  difficulty: LearningDifficulty;
  level: LearningLevel | null;
  type: LearningQuestionType;
}

export interface TopicOverrideRow {
  title: string;
  summary: string;
  concepts: string[];
  principles: string[];
  applications: string[];
  pitfalls: string[];
  method: string;
  exercise: string;
  checkpoint: string;
  lesson: LearningTopicLesson | null;
}

// 本次导出：2026-10-14T13:45:43.122Z（题目 0 / 知识点 0）
/** 题目覆盖：key → 整行内容（数据库为准） */
export const questionOverrides: Record<string, QuestionOverrideRow> = {};

/** 知识点覆盖：`<trackSlug>::<topicKey>` → 整行内容 */
export const topicOverrides: Record<string, TopicOverrideRow> = {};
