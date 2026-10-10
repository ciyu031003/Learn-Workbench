import { describe, expect, it } from "vitest";
import {
  learningCategories,
  learningTracks,
  type LearningQuestion,
  type LearningTrack,
} from "./index";

const nonEmpty = (value: string) => value.trim().length > 0;

function expectCompleteQuestion(question: LearningQuestion, track: LearningTrack) {
  expect(nonEmpty(question.key), `${track.slug}: question key`).toBe(true);
  expect(nonEmpty(question.stem), `${track.slug}/${question.key}: stem`).toBe(true);
  expect(nonEmpty(question.explanation), `${track.slug}/${question.key}: explanation`).toBe(true);
  expect(question.tags.length, `${track.slug}/${question.key}: tags`).toBeGreaterThan(0);
  expect(question.options.length, `${track.slug}/${question.key}: options`).toBeGreaterThanOrEqual(2);
  expect(question.answer.length, `${track.slug}/${question.key}: answer`).toBeGreaterThan(0);

  const optionKeys = new Set(question.options.map((option) => option.key));
  expect(optionKeys.size, `${track.slug}/${question.key}: duplicate option key`).toBe(
    question.options.length
  );
  for (const answer of question.answer) {
    expect(optionKeys.has(answer), `${track.slug}/${question.key}: unknown answer ${answer}`).toBe(
      true
    );
  }
  if (question.type === "single" || question.type === "judge") {
    expect(question.answer, `${track.slug}/${question.key}: single answer`).toHaveLength(1);
  }
}

describe("learning library content contract", () => {
  it("provides the expanded learning tracks and stable categories", () => {
    expect(learningTracks.map((track) => track.slug)).toEqual([
      "python",
      "java",
      "javascript",
      "data-analysis",
      "power-bi",
      "linux",
      "ai-engineering",
      "database",
      "cloud-platform",
      "network-engineering",
    ]);
    expect(new Set(learningTracks.map((track) => track.slug)).size).toBe(learningTracks.length);
    expect(learningCategories).toEqual([...new Set(learningTracks.map((track) => track.category))]);
    expect(learningTracks.reduce((total, track) => total + track.questions.length, 0)).toBe(400);
    // 阶段 12：160 道「待分类题」已全部绑定知识点 → 400 道题全部带 topicKey，待分类清零
    expect(learningTracks.flatMap((track) => track.questions).filter((question) => question.topicKey)).toHaveLength(400);
    expect(learningTracks.reduce((total, track) => total + track.stages.length, 0)).toBe(40);
  });

  it("keeps every track, stage, topic and question fully authored", () => {
    for (const track of learningTracks) {
      expect(nonEmpty(track.title), `${track.slug}: title`).toBe(true);
      expect(nonEmpty(track.summary), `${track.slug}: summary`).toBe(true);
      expect(nonEmpty(track.whyLearn), `${track.slug}: whyLearn`).toBe(true);
      expect(track.prerequisites.length, `${track.slug}: prerequisites`).toBeGreaterThan(0);
      expect(track.studyMethod.length, `${track.slug}: studyMethod`).toBeGreaterThan(0);
      expect(track.estimatedHours, `${track.slug}: estimatedHours`).toBeGreaterThan(0);
      expect(track.stages.length, `${track.slug}: stages`).toBeGreaterThanOrEqual(4);
      expect(track.questions.length, `${track.slug}: questions`).toBeGreaterThanOrEqual(16);

      const stageKeys = new Set(track.stages.map((stage) => stage.key));
      expect(stageKeys.size, `${track.slug}: duplicate stage key`).toBe(track.stages.length);

      const topicKeys = new Set<string>();
      for (const stage of track.stages) {
        expect(nonEmpty(stage.title), `${track.slug}/${stage.key}: title`).toBe(true);
        expect(nonEmpty(stage.goal), `${track.slug}/${stage.key}: goal`).toBe(true);
        expect(nonEmpty(stage.outcome), `${track.slug}/${stage.key}: outcome`).toBe(true);
        expect(stage.topics.length, `${track.slug}/${stage.key}: topics`).toBeGreaterThanOrEqual(3);
        expect(stage.lesson, `${track.slug}/${stage.key}: lesson`).toBeDefined();
        expect(stage.lesson?.overview.length, `${track.slug}/${stage.key}: lesson overview`).toBeGreaterThan(0);
        expect(stage.lesson?.studyLoop.length, `${track.slug}/${stage.key}: study loop`).toBeGreaterThanOrEqual(3);
        expect(stage.lesson?.milestones.length, `${track.slug}/${stage.key}: milestones`).toBeGreaterThanOrEqual(3);
        expect(stage.lesson?.completionCriteria.length, `${track.slug}/${stage.key}: completion`).toBeGreaterThanOrEqual(3);

        for (const topic of stage.topics) {
          expect(topicKeys.has(topic.key), `${track.slug}: duplicate topic key ${topic.key}`).toBe(
            false
          );
          topicKeys.add(topic.key);
          expect(nonEmpty(topic.title), `${track.slug}/${topic.key}: title`).toBe(true);
          expect(nonEmpty(topic.summary), `${track.slug}/${topic.key}: summary`).toBe(true);
          expect(nonEmpty(topic.method), `${track.slug}/${topic.key}: method`).toBe(true);
          expect(nonEmpty(topic.exercise), `${track.slug}/${topic.key}: exercise`).toBe(true);
          expect(nonEmpty(topic.checkpoint), `${track.slug}/${topic.key}: checkpoint`).toBe(true);
          expect(topic.concepts.length, `${track.slug}/${topic.key}: concepts`).toBeGreaterThan(0);
          expect(topic.principles.length, `${track.slug}/${topic.key}: principles`).toBeGreaterThan(
            0
          );
          expect(
            topic.applications.length,
            `${track.slug}/${topic.key}: applications`
          ).toBeGreaterThan(0);
          expect(topic.pitfalls.length, `${track.slug}/${topic.key}: pitfalls`).toBeGreaterThan(0);
          expect(topic.lesson, `${track.slug}/${topic.key}: lesson`).toBeDefined();
          expect(topic.lesson?.overview.length, `${track.slug}/${topic.key}: lesson overview`).toBeGreaterThanOrEqual(2);
          expect(topic.lesson?.mechanism.length, `${track.slug}/${topic.key}: lesson mechanism`).toBeGreaterThanOrEqual(2);
          expect(nonEmpty(topic.lesson?.example.title ?? ""), `${track.slug}/${topic.key}: example title`).toBe(true);
          expect(nonEmpty(topic.lesson?.example.language ?? ""), `${track.slug}/${topic.key}: example language`).toBe(true);
          expect(nonEmpty(topic.lesson?.example.code ?? ""), `${track.slug}/${topic.key}: example code`).toBe(true);
          expect(nonEmpty(topic.lesson?.example.explanation ?? ""), `${track.slug}/${topic.key}: example explanation`).toBe(true);
          expect(topic.lesson?.practiceSteps.length, `${track.slug}/${topic.key}: practice steps`).toBeGreaterThanOrEqual(3);
          expect(topic.lesson?.masteryChecklist.length, `${track.slug}/${topic.key}: mastery checklist`).toBeGreaterThanOrEqual(2);

          const topicQuestions = track.questions.filter((question) => question.topicKey === topic.key);
          expect(topicQuestions.length, `${track.slug}/${topic.key}: topic questions`).toBeGreaterThanOrEqual(2);
          for (const question of topicQuestions) {
            expect(question.explanation.length, `${track.slug}/${question.key}: explanation quality`).toBeGreaterThanOrEqual(20);
          }
        }
      }
    }
  });

  it("keeps stage, question and source references closed", () => {
    const globalQuestionKeys = new Set<string>();

    for (const track of learningTracks) {
      const sourceKeys = new Set(track.sources.map((source) => source.key));
      expect(sourceKeys.size, `${track.slug}: duplicate source key`).toBe(track.sources.length);
      expect(sourceKeys.size, `${track.slug}: sources`).toBeGreaterThan(0);

      for (const source of track.sources) {
        expect(nonEmpty(source.name), `${track.slug}/${source.key}: source name`).toBe(true);
        expect(source.url.startsWith("https://"), `${track.slug}/${source.key}: source url`).toBe(
          true
        );
        expect(nonEmpty(source.license), `${track.slug}/${source.key}: source license`).toBe(true);
        expect(nonEmpty(source.note), `${track.slug}/${source.key}: source note`).toBe(true);
        if (source.usage === "import") {
          expect(
            /^(MIT|BSD(-[23]-Clause)?|CC BY( |$))/i.test(source.license),
            `${track.slug}/${source.key}: import license ${source.license}`
          ).toBe(true);
        }
      }

      const questionsByKey = new Map(track.questions.map((question) => [question.key, question]));
      expect(questionsByKey.size, `${track.slug}: duplicate question key`).toBe(
        track.questions.length
      );
      const referencedQuestionKeys = new Set<string>();

      for (const stage of track.stages) {
        for (const questionKey of stage.questionKeys) {
          const question = questionsByKey.get(questionKey);
          expect(question, `${track.slug}/${stage.key}: unknown question ${questionKey}`).toBeDefined();
          expect(question?.stageKey, `${track.slug}/${questionKey}: stageKey`).toBe(stage.key);
          expect(
            referencedQuestionKeys.has(questionKey),
            `${track.slug}: question ${questionKey} referenced twice`
          ).toBe(false);
          referencedQuestionKeys.add(questionKey);
        }
      }

      for (const question of track.questions) {
        expect(
          globalQuestionKeys.has(question.key),
          `global duplicate question key ${question.key}`
        ).toBe(false);
        globalQuestionKeys.add(question.key);
        expect(track.stages.some((stage) => stage.key === question.stageKey)).toBe(true);
        expect(sourceKeys.has(question.sourceKey), `${track.slug}/${question.key}: sourceKey`).toBe(
          true
        );
        expectCompleteQuestion(question, track);
      }

      expect(referencedQuestionKeys.size, `${track.slug}: referenced questions`).toBe(
        track.questions.length
      );
    }
  });
});
