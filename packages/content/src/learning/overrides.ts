/**
 * 应用「数据库 → 内容包」覆盖（075/076 之后的回写闭环）。
 *
 * 顺序：内容包原始内容 → expandLearningTrack（补讲义/题目）→ **applyContentOverrides**。
 * 覆盖来自 DB 里人工编辑过的行（由脚本导出成 content-overrides.ts），
 * 因此前台无论走内容包（离线兜底）还是走数据库，看到的都是同一份内容。
 */
import {
  questionOverrides as generatedQuestionOverrides,
  topicOverrides as generatedTopicOverrides,
  type QuestionOverrideRow,
  type TopicOverrideRow,
} from "./content-overrides";
import type { LearningTrack } from "./types";

export interface ContentOverrideData {
  questionOverrides: Record<string, QuestionOverrideRow>;
  topicOverrides: Record<string, TopicOverrideRow>;
}

const DEFAULT_DATA: ContentOverrideData = {
  questionOverrides: generatedQuestionOverrides,
  topicOverrides: generatedTopicOverrides,
};

export function hasContentOverrides(data: ContentOverrideData = DEFAULT_DATA): boolean {
  return Object.keys(data.questionOverrides).length > 0 || Object.keys(data.topicOverrides).length > 0;
}

/** 把覆盖应用到单门课程（未命中覆盖的题目/知识点原样返回）。 */
export function applyContentOverrides(
  track: LearningTrack,
  data: ContentOverrideData = DEFAULT_DATA
): LearningTrack {
  if (!hasContentOverrides(data)) return track;

  const questions = track.questions.map((question) => {
    const override = data.questionOverrides[question.key];
    if (!override) return question;
    return {
      ...question,
      stem: override.stem,
      options: override.options,
      answer: override.answer,
      explanation: override.explanation,
      tags: override.tags,
      difficulty: override.difficulty,
      type: override.type,
      level: override.level ?? undefined,
    };
  });

  const stages = track.stages.map((stage) => ({
    ...stage,
    topics: stage.topics.map((topic) => {
      const override = data.topicOverrides[track.slug + "::" + topic.key];
      if (!override) return topic;
      return {
        ...topic,
        title: override.title,
        summary: override.summary,
        concepts: override.concepts,
        principles: override.principles,
        applications: override.applications,
        pitfalls: override.pitfalls,
        method: override.method,
        exercise: override.exercise,
        checkpoint: override.checkpoint,
        lesson: override.lesson ?? undefined,
      };
    }),
  }));

  return { ...track, questions, stages };
}
