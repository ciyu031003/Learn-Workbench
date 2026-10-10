import type { LearningQuestion, LearningTrack } from "@learn-workbench/content";

/** Web 学习页与 career/interview 保持同一套难度文案 */
export const LEARNING_DIFFICULTY_LABEL: Record<string, string> = {
  easy: "易",
  medium: "中",
  hard: "难",
};

export interface TrackStats {
  stages: number;
  topics: number;
  questions: number;
  /** 已撰写完整 lesson 的知识点数 */
  withLesson: number;
  estimatedHours: number;
}

export interface StageStats {
  topics: number;
  questions: number;
}

/**
 * 课程统计（真实数据，UI 不编造数字）。
 * 内容来自 `@learn-workbench/content` 静态包；题目按 `topicKey`/`stageKey` 归属。
 */
export function trackStats(track: LearningTrack): TrackStats {
  const topics = track.stages.flatMap((stage) => stage.topics);
  return {
    stages: track.stages.length,
    topics: topics.length,
    questions: track.questions.length,
    withLesson: topics.filter((topic) => Boolean(topic.lesson)).length,
    estimatedHours: track.estimatedHours,
  };
}

export function stageStats(track: LearningTrack, stageKey: string): StageStats {
  const stage = track.stages.find((item) => item.key === stageKey);
  return {
    topics: stage?.topics.length ?? 0,
    questions: track.questions.filter((question) => question.stageKey === stageKey).length,
  };
}

export function topicQuestions(track: LearningTrack, topicKey: string): LearningQuestion[] {
  return track.questions.filter((question) => question.topicKey === topicKey);
}

/** 题库覆盖率：带知识点归属的题目占比（0..1） */
export function questionLinkCoverage(track: LearningTrack): number {
  if (track.questions.length === 0) return 0;
  return track.questions.filter((question) => Boolean(question.topicKey)).length / track.questions.length;
}
