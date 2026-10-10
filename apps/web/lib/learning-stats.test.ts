import { describe, expect, it } from "vitest";
import { getLearningTrack } from "@learn-workbench/content";
import { questionLinkCoverage, stageStats, topicQuestions, trackStats } from "./learning-stats";

const python = getLearningTrack("python");

describe("learning stats", () => {
  it("aggregates stages/topics/questions from the static content package", () => {
    expect(python).toBeTruthy();
    const stats = trackStats(python!);
    expect(stats.stages).toBeGreaterThanOrEqual(4);
    expect(stats.topics).toBeGreaterThanOrEqual(stats.stages * 3);
    expect(stats.questions).toBeGreaterThanOrEqual(16);
    // 内容契约要求每个知识点都有 lesson
    expect(stats.withLesson).toBe(stats.topics);
  });

  it("scopes topics and questions to a stage", () => {
    const stageKey = python!.stages[0].key;
    const stats = stageStats(python!, stageKey);
    expect(stats.topics).toBe(python!.stages[0].topics.length);
    expect(stats.questions).toBe(python!.questions.filter((q) => q.stageKey === stageKey).length);
  });

  it("links each topic to at least two questions", () => {
    for (const topic of python!.stages.flatMap((stage) => stage.topics)) {
      expect(topicQuestions(python!, topic.key).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports question-to-topic link coverage", () => {
    const coverage = questionLinkCoverage(python!);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThanOrEqual(1);
  });
});
