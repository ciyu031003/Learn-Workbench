import { describe, expect, it } from "vitest";
import {
  algorithmAnimations,
  learningCategories,
  learningTracks,
  type LearningQuestion,
  type LearningTrack,
} from "./index";

const nonEmpty = (value: string) => value.trim().length > 0;

/**
 * 可导入来源的许可门槛（2026-10-11 口径变更）。
 *
 * 旧口径只放行"允许再分发"的宽松许可（MIT / BSD / CC BY）。用户明确本项目**个人自用、不商用**，
 * 因此放宽为：只要来源**声明了已知许可**即可 `import`（GPL / LGPL / Apache / CC BY-SA 等一并放行）。
 * 仍然拦下的：空串 / `unknown` / `NOASSERTION` —— 连许可文本都没有的仓库，连"依据"都没有。
 * 许可字段本身仍如实登记（核验方式见 db/migrations/068_*.sql 头注释）。
 */
/**
 * 历史口径：import 来源必须是「可再分发的开放许可」。
 *
 * 口径变更（2026-10-11，用户决策 + 迁移 068）：个人自用、不商用，不再按「许可是否允许再分发」
 * 限制 `usage: import`；但仍要求**如实登记的已知许可** —— 空串 / unknown / NOASSERTION / n/a
 * 依然拦下（连来源依据都没有才是不合格的）。开放许可（MIT / BSD / Apache-2.0 / CC BY / GPL 等）
 * 仍然更受欢迎：选源时优先挑开放许可。
 */
const BLOCKED_LICENSE_RE = /^(unknown|noassertion|none|n\/?a|)$/i;

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
      "algorithms",
      "backend-engineering",
      "application-security",
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
      "computer-networking",
      "operating-systems",
      "computer-organization",
      "ex-408",
      "ex-408-grad",
      "rn-frontend",
      "rn-lang",
      "rn-cs-tools",
    ]);
    expect(new Set(learningTracks.map((track) => track.slug)).size).toBe(learningTracks.length);
    expect(learningCategories).toEqual([...new Set(learningTracks.map((track) => track.category))]);
    // 2026-10 题库扩容：16 门技术课各补 30 题（java 28），合计 +478 → 2413
    // 2026-10-15 知识点扩容：后端工程 2 + 应用安全/数据库/Java/Python 各 6 = 26 个知识点 / +52 题 → 2465
    expect(learningTracks.reduce((total, track) => total + track.questions.length, 0)).toBe(2631);
    // 阶段 12：160 道「待分类题」已全部绑定知识点 → 全部题目都带 topicKey，待分类清零
    // ex-408 自带 12 个知识点 × 2 题 = 24 道带 topicKey 的原创题
    // 408 真题库（exam-bank）为「阶段级附加题」，不绑知识点
    // ex-408-grad（csgraduates）：717 道真题，689 挂章级知识点 + 28 阶段级
    // runoob（菜鸟教程）三课程：92 个知识点全部带 topicKey，436 道题全部挂在知识点上
    // 数据结构扩容（algorithms 课程 DS 十章）：39 个知识点全部带 topicKey，78 道题全部挂在知识点上
    // → 1693 + 78 = 1771
    // 题库扩容后：1771 + 478 = 2249；知识点扩容再加 52 题 → 2301
    expect(learningTracks.flatMap((track) => track.questions).filter((question) => question.topicKey)).toHaveLength(2467);
    // v1.44 跨源去重：exam-bank 的 ex-408 与 csgraduates 是同一批统考真题（124 道重复），
    // 已由 scripts/cs-bank/dedup_exam_bank.py 从 exam-bank 侧剔除（保留带解析的 csgraduates 那份）。
    // 总数 2059 → 1935；有 topicKey 的 1771 不变（被删的都是无 topicKey 的阶段级题）。
    // 这里加一条**方向性**断言：如果哪天又出现重复，题量会重新上涨并被这条测试抓住。
    expect(learningTracks.reduce((total, track) => total + track.questions.length, 0)).toBeLessThanOrEqual(2631);
    // 数据结构扩容新增 10 个阶段：91 + 10 = 101
    expect(learningTracks.reduce((total, track) => total + track.stages.length, 0)).toBe(101);
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
          // 只要求「如实登记的已知许可」；空 / unknown / NOASSERTION 仍然拦下。
          expect(
            !BLOCKED_LICENSE_RE.test(source.license.trim()),
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

describe("algorithm animations contract", () => {
  it("知识点引用的动图 key 都能解析，且每张动图都是多帧、有说明、无危险片段", () => {
    const dangerous = /<\s*(script|iframe|object|embed|style|link|meta)\b|on(error|load|click)\s*=|\bjavascript:/i;
    const referenced = new Set<string>();

    for (const track of learningTracks) {
      for (const stage of track.stages) {
        for (const topic of stage.topics) {
          for (const key of topic.animations ?? []) {
            const frames = algorithmAnimations[key];
            expect(frames, `${track.slug}/${topic.key}: 未知动图 ${key}`).toBeDefined();
            referenced.add(key);
          }
        }
      }
    }

    expect(referenced.size).toBeGreaterThanOrEqual(10);
    for (const [key, frames] of Object.entries(algorithmAnimations)) {
      expect(frames.length, `${key}: 动图帧数`).toBeGreaterThanOrEqual(3);
      for (const frame of frames) {
        expect(frame.caption.trim().length, `${key}: 帧说明`).toBeGreaterThan(0);
        expect(frame.svg.startsWith("<svg"), `${key}: 帧 SVG 结构`).toBe(true);
        expect(dangerous.test(frame.svg) || dangerous.test(frame.caption), `${key}: 危险片段`).toBe(false);
      }
    }
  });
});
