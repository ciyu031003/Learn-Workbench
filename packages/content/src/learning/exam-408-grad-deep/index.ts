import type { LearningTopic, LearningTrack } from "../types";
import { exam408DeepLessons } from "./registry";
import type { Exam408DeepLesson } from "./types";

export { EXAM408_DEEP_CHAPTER_KEYS, exam408DeepLessons } from "./registry";

/** 去重并丢弃空串：追加层可能和骨架内容重复，这里做一次收口。 */
const uniq = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const text = item.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
};

function mergeTopic(topic: LearningTopic, deep: Exam408DeepLesson): LearningTopic {
  const lesson = topic.lesson;
  return {
    ...topic,
    concepts: uniq([...topic.concepts, ...(deep.concepts ?? [])]),
    applications: uniq([...topic.applications, ...(deep.applications ?? [])]),
    pitfalls: uniq([...topic.pitfalls, ...(deep.pitfalls ?? [])]),
    ...(lesson
      ? {
          lesson: {
            ...lesson,
            overview: uniq([...lesson.overview, ...(deep.overview ?? [])]),
            mechanism: uniq([...lesson.mechanism, ...(deep.mechanism ?? [])]),
            summary: uniq([...(lesson.summary ?? []), ...(deep.summary ?? [])]),
            terms: [...(lesson.terms ?? []), ...(deep.terms ?? [])],
            practiceSteps: deep.practiceSteps ?? lesson.practiceSteps,
            masteryChecklist: deep.masteryChecklist ?? lesson.masteryChecklist,
            example: deep.example ?? lesson.example,
          },
        }
      : {}),
  };
}

/**
 * 把 `exam-408-grad-deep/*` 的追加内容合并进 ex-408-grad 轨道（纯函数，不改入参）。
 * 对没有加深内容的章节原样返回，因此可安全用于任何状态的内容包。
 */
export function applyExam408DeepLessons(track: LearningTrack): LearningTrack {
  return {
    ...track,
    stages: track.stages.map((stage) => ({
      ...stage,
      topics: stage.topics.map((topic) => {
        const deep = exam408DeepLessons[topic.key];
        return deep ? mergeTopic(topic, deep) : topic;
      }),
    })),
  };
}
