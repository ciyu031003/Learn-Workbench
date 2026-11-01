import type { LearningCodeExample, LearningTerm } from "../types";

/**
 * 408 讲义「加深层」（2026-11）。
 *
 * 为什么单独一层：`exam-408-grad.ts` 由 `scripts/cs-graduates/generate.mjs` 生成
 * （站点 88 细页按章聚合），重跑生成器会被覆盖。本目录只做**追加**：
 * 章节级知识点在「深入理解 / 运作机制 / 本章小结 / 术语白话 / 常见误区」上补正文，
 * 由 `applyExam408DeepLessons` 在 `learning/index.ts` 里合并进 `ex-408-grad` 轨道。
 *
 * 素材来源：本机 408 考研资料（王道复习指导对应的分章笔记 PDF 抽取文本、背诵知识点、
 * 历年真题考频统计、官方考试大纲）。正文为原创改写，不原样粘贴 PDF。
 */
export interface Exam408DeepLesson {
  /** 追加到「深入理解」：考纲定位 / 知识地图 / 真题考情 */
  overview?: string[];
  /** 追加到「运作机制」：按板块组织的讲解，板块首段以「【板块名】」开头 */
  mechanism?: string[];
  /** 「本章小结」：合上书能背出来的短句 */
  summary?: string[];
  /** 「术语白话」：本章行话的人话解释 */
  terms?: LearningTerm[];
  /** 追加到「常见误区」 */
  pitfalls?: string[];
  /** 追加概念标签 */
  concepts?: string[];
  /** 追加「它可以解决什么」 */
  applications?: string[];
  /** 覆盖「练习路径」（可选） */
  practiceSteps?: string[];
  /** 覆盖「掌握自检」（可选） */
  masteryChecklist?: string[];
  /** 覆盖代码示例（可选；前 25 章已有示例，非必要不改） */
  example?: LearningCodeExample;
}

/** key = 章级知识点 key（ex408g-*） */
export type Exam408DeepLessonMap = Record<string, Exam408DeepLesson>;
