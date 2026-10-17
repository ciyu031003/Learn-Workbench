/**
 * 知识点扩容登记表（2026-10-15）。
 *
 * 背景：题库已经能通过 `supplement-*.ts` 追加题目，但**知识点本身**只能改各门课的
 * 大文件（`algorithms.ts` 这类，动辄上千行），批量扩充知识点代价高、冲突也大。
 * 这里提供同款"追加式"入口：每个 track 一个 `topic-expansion-<slug>.ts`，
 * 导出若干 `TopicExpansion`（知识点 + 它自带的配套题），由 `expandLearningTrack` 合并进对应阶段。
 *
 * 约束（与内容门禁一致，缺一项测试不过）：
 *   - `topic.key` 在课程内唯一，且不能与既有知识点重复；
 *   - 每条 expansion 必须带 **≥2 道**配套题（`questions`），且题的 `stageKey/topicKey` 与之对齐；
 *   - `topic.lesson` 必须完整：overview ≥2、mechanism ≥2、example（title/language/code/explanation）、
 *     practiceSteps ≥3、masteryChecklist ≥2；建议再给 `summary`（本章小结）与 `terms`（术语白话）。
 */
import { algorithmsTopicExpansions } from "./topic-expansion-algorithms";
import { applicationSecurityTopicExpansions } from "./topic-expansion-application-security";
import { javascriptTopicExpansions } from "./topic-expansion-javascript";
import { pythonTopicExpansionsB } from "./topic-expansion-python-b";
import { backendEngineeringTopicExpansions } from "./topic-expansion-backend-engineering";
import { backendEngineeringTopicExpansionsB } from "./topic-expansion-backend-engineering-b";
import { backendEngineeringTopicExpansionsC } from "./topic-expansion-backend-engineering-c";
import { databaseTopicExpansions } from "./topic-expansion-database";
import { javaTopicExpansions } from "./topic-expansion-java";
import { pythonTopicExpansions } from "./topic-expansion-python";
import type { LearningQuestion, LearningTopic } from "./types";

export interface TopicExpansion {
  trackSlug: string;
  stageKey: string;
  topic: LearningTopic;
  questions: LearningQuestion[];
}

/** 各 track 的知识点扩容（新增文件后在下面登记） */
export const topicExpansions: TopicExpansion[] = [
  ...algorithmsTopicExpansions,
  ...applicationSecurityTopicExpansions,
  ...javascriptTopicExpansions,
  ...pythonTopicExpansionsB,
  ...backendEngineeringTopicExpansions,
  ...backendEngineeringTopicExpansionsB,
  ...backendEngineeringTopicExpansionsC,
  ...databaseTopicExpansions,
  ...javaTopicExpansions,
  ...pythonTopicExpansions,
];
