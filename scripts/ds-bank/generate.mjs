/**
 * 数据结构扩容生成器：scripts/ds-bank/stages-*.mjs → packages/content/src/learning/ds-expansion.ts
 *
 * stages-*.mjs 里只写「知识点独有内容」（概念/原理/应用/易错/示例/题目/动图 key）；
 * 学法脚手架（method/exercise/checkpoint/lesson 与阶段 lesson）由本脚本按知识点字段生成，
 * 保证每个知识点与阶段都满足内容质量契约（L4）。
 */
import fs from "node:fs";
import { STAGES_1 } from "./stages-1.mjs";
import { STAGES_2 } from "./stages-2.mjs";
import { STAGES_3 } from "./stages-3.mjs";
import { STAGES_4 } from "./stages-4.mjs";
import { STAGES_5 } from "./stages-5.mjs";
import { ANIMATION_KEYS } from "./svg.mjs";

const SOURCES = ["algorithms-python", "algorithms-java", "algorithms-go", "algorithms-javascript"];
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const stages = [...STAGES_1, ...STAGES_2, ...STAGES_3, ...STAGES_4, ...STAGES_5];

const firstClause = (text, max = 44) => {
  const cut = String(text).split(/[，。；、,;]/)[0].trim();
  return cut.length > max ? cut.slice(0, max) : cut;
};

function topicScaffold(topic) {
  const { concepts: c, principles: p, applications: a, pitfalls: o } = topic;
  const method = `先抓住「${c[0]}」与「${c[1] ?? c[0]}」两个抓手，再用「${firstClause(p[0])}」这条主线推导，最后写代码验证并记录代价。`;
  const exercise = `围绕「${topic.title}」做一次闭环练习：在「${a[0]}」的场景下，把示例「${topic.example.title}」亲手实现或演算一遍，并写出时间/空间复杂度。`;
  const checkpoint = `不看笔记能回答：${firstClause(o[0], 30)}为什么会出错？并能用最小样例复现与纠正。`;
  const overview = [topic.summary, `核心结论：${p[0]}`];
  let mechanism = p.slice(1, 3);
  if (mechanism.length < 2) {
    mechanism = [...mechanism, `它决定了「${a[0]}」场景下的取舍，也解释了常见的出错点。`];
  }
  const practiceSteps = [
    `用自己的话写出「${c[0]}」的定义，并各举一个正例与一个反例。`,
    `亲手实现或演算示例「${topic.example.title}」，跑通后故意改错一处，观察失败现象。`,
    `在「${a[0]}」场景里构造一个边界用例，确认不会踩到「${firstClause(o[0], 24)}」。`,
  ];
  const masteryChecklist = [
    `能不看示例复述「${topic.title}」的核心机制，并说明复杂度或代价。`,
    `能指出「${firstClause(o[0], 24)}」为什么错，并给出正确做法。`,
    `能独立完成示例并逐行解释它在做什么。`,
  ];
  return {
    method,
    exercise,
    checkpoint,
    lesson: { overview, mechanism, example: topic.example, practiceSteps, masteryChecklist },
  };
}

function stageScaffold(stage) {
  const overview = [stage.goal, stage.outcome];
  const studyLoop = [
    `先读「${stage.topics[0].title}」，在纸上手推一个最小样例`,
    "按顺序实现本阶段核心代码，跑通后再补边界用例",
    "故意破坏一个前提，观察失败现象并定位原因",
    "把本阶段的易错点整理成自己的清单",
  ];
  const milestones = stage.topics.map((topic) => ({
    title: `掌握：${topic.title}`,
    evidence: `能独立完成「${topic.title}」的示例与配套自测题。`,
  }));
  const completionCriteria = [
    `能独立完成本阶段全部 ${stage.topics.length} 个知识点的示例与自测。`,
    "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
    stage.outcome,
  ];
  return { overview, studyLoop, milestones, completionCriteria };
}

const problems = [];
const questionLines = [];
const stageLines = [];
const seenTopicKeys = new Set();

let questionIndex = 0;

for (const stage of stages) {
  for (const topic of stage.topics) {
    if (seenTopicKeys.has(topic.key)) problems.push(`知识点 key 重复：${topic.key}`);
    seenTopicKeys.add(topic.key);
  }
}

for (const stage of stages) {
  const scaffold = stageScaffold(stage);
  const topicBlocks = [];
  const questionKeys = [];

  for (const topic of stage.topics) {
    const t = topicScaffold(topic);
    for (const animationKey of topic.animations ?? []) {
      if (!ANIMATION_KEYS.includes(animationKey)) problems.push(`${topic.key} 引用了不存在的动图 ${animationKey}`);
    }

    const singles = topic.questions.filter((question) => typeof question.answer === "string");
    const judges = topic.questions.filter((question) => typeof question.answer === "boolean");
    if (singles.length !== 1 || judges.length !== 1) {
      problems.push(`${topic.key} 题目形状异常：single=${singles.length} judge=${judges.length}`);
    }

    for (const question of singles) {
      const sourceKey = SOURCES[questionIndex % SOURCES.length];
      questionIndex += 1;
      if (question.options.length !== 4) problems.push(`${topic.key} 单选题选项数=${question.options.length}`);
      if (!DIFFICULTIES.has(question.difficulty)) problems.push(`${topic.key} 难度异常 ${question.difficulty}`);
      if (question.explanation.length < 20) problems.push(`${topic.key} 解析过短`);
      const key = `${topic.key}-single`;
      questionKeys.push(key);
      questionLines.push([
        "  singleQuestion({",
        `    key: ${JSON.stringify(key)},`,
        `    stageKey: ${JSON.stringify(stage.key)},`,
        `    topicKey: ${JSON.stringify(topic.key)},`,
        `    stem: ${JSON.stringify(question.stem)},`,
        `    options: ${JSON.stringify(question.options)},`,
        `    answer: ${JSON.stringify(question.answer)},`,
        `    explanation: ${JSON.stringify(question.explanation)},`,
        `    difficulty: ${JSON.stringify(question.difficulty)},`,
        `    tags: ${JSON.stringify(question.tags)},`,
        `    sourceKey: ${JSON.stringify(sourceKey)},`,
        "  }),",
      ].join("\n"));
    }

    for (const question of judges) {
      const sourceKey = SOURCES[questionIndex % SOURCES.length];
      questionIndex += 1;
      if (!DIFFICULTIES.has(question.difficulty)) problems.push(`${topic.key} 难度异常 ${question.difficulty}`);
      if (question.explanation.length < 20) problems.push(`${topic.key} 解析过短`);
      const key = `${topic.key}-judge`;
      questionKeys.push(key);
      questionLines.push([
        "  judgeQuestion({",
        `    key: ${JSON.stringify(key)},`,
        `    stageKey: ${JSON.stringify(stage.key)},`,
        `    topicKey: ${JSON.stringify(topic.key)},`,
        `    stem: ${JSON.stringify(question.stem)},`,
        `    answer: ${question.answer ? "true" : "false"},`,
        `    explanation: ${JSON.stringify(question.explanation)},`,
        `    difficulty: ${JSON.stringify(question.difficulty)},`,
        `    tags: ${JSON.stringify(question.tags)},`,
        `    sourceKey: ${JSON.stringify(sourceKey)},`,
        "  }),",
      ].join("\n"));
    }

    topicBlocks.push([
      "      {",
      `        key: ${JSON.stringify(topic.key)},`,
      `        title: ${JSON.stringify(topic.title)},`,
      `        summary: ${JSON.stringify(topic.summary)},`,
      `        concepts: ${JSON.stringify(topic.concepts)},`,
      `        principles: ${JSON.stringify(topic.principles)},`,
      `        applications: ${JSON.stringify(topic.applications)},`,
      `        pitfalls: ${JSON.stringify(topic.pitfalls)},`,
      `        method: ${JSON.stringify(t.method)},`,
      `        exercise: ${JSON.stringify(t.exercise)},`,
      `        checkpoint: ${JSON.stringify(t.checkpoint)},`,
      `        lesson: ${JSON.stringify(t.lesson, null, 2).split("\n").map((line, i) => (i === 0 ? line : "        " + line)).join("\n")},`,
      ...(topic.animations ? [`        animations: ${JSON.stringify(topic.animations)},`] : []),
      "      },",
    ].join("\n"));
  }

  stageLines.push([
    "  {",
    `    key: ${JSON.stringify(stage.key)},`,
    `    title: ${JSON.stringify(stage.title)},`,
    `    weeks: ${JSON.stringify(stage.weeks)},`,
    `    goal: ${JSON.stringify(stage.goal)},`,
    `    outcome: ${JSON.stringify(stage.outcome)},`,
    `    lesson: ${JSON.stringify(scaffold, null, 2).split("\n").map((line, i) => (i === 0 ? line : "    " + line)).join("\n")},`,
    "    topics: [",
    topicBlocks.join("\n"),
    "    ],",
    `    questionKeys: ${JSON.stringify(questionKeys)},`,
    "  },",
  ].join("\n"));
}

if (problems.length > 0) {
  console.error("[ds-expand] 数据校验失败：");
  for (const problem of problems) console.error("  - " + problem);
  process.exit(1);
}

const header = [
  "/**",
  " * 数据结构扩容内容包（算法与数据结构课程 · DS 十章）。",
  " *",
  " * 由 `scripts/ds-bank/generate.mjs` 生成，请勿手改。知识点独有内容来自 scripts/ds-bank/stages-*.mjs，",
  " * 学法脚手架由生成器补齐；动图 key 见 `algorithm-animations.ts`。",
  " */",
  'import { judgeQuestion, singleQuestion } from "./question-builders";',
  'import type { LearningQuestion, LearningStage } from "./types";',
  "",
  "export const dsExpansionQuestions: LearningQuestion[] = [",
].join("\n");

const body = [
  header,
  questionLines.join("\n"),
  "];",
  "",
  "export const dsExpansionStages: LearningStage[] = [",
  stageLines.join("\n"),
  "];",
  "",
].join("\n");

const target = "packages/content/src/learning/ds-expansion.ts";
fs.writeFileSync(target, body, "utf8");

const topicCount = stages.reduce((sum, stage) => sum + stage.topics.length, 0);
const questionCount = questionLines.length;
const animatedCount = stages.reduce((sum, stage) => sum + stage.topics.filter((topic) => topic.animations?.length).length, 0);
console.log(
  `[ds-expand] 写入 ${target}：${stages.length} 阶段 / ${topicCount} 知识点 / ${questionCount} 题 / ${animatedCount} 个知识点带动图`
);
