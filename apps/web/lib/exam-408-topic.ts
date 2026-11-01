import { pgPool } from "@/lib/db";

import { externalizePointKey, internalizePointKey } from "./exam-408-point-key";
import type { Exam408Question } from "@/lib/exam-408";
import {
  normalizeAnswerSteps,
  normalizeOptionalText,
  type Exam408CardContent,
} from "@/lib/exam-408-cards";
import type { Exam408DemoSummary } from "@/lib/exam-408-demos";
import {
  compareStudyTopics,
  mapStudyTopicSummary,
  type StudyTopicRow,
  type StudyTopicSummary,
} from "@/lib/exam-408-study";

/**
 * 408 知识点聚合：一个知识点同时挂「精读文章 / 速记卡 / 交互演示 / 历年真题」。
 *
 * 数据来源（迁移 085-087 与 task-17 的映射脚本 scripts/cs408-study/map-points.mjs）：
 * - exam_408_study_topics.knowledge_point_key —— 精读文章（cs408.cloud，181 篇）
 * - exam_408_cards.knowledge_point_key —— 速记卡（408card.top，529 张）
 * - exam_408_demos.knowledge_point_key —— 交互演示（98 个，抓取入库后由脚本二次回填）
 * - exam_408_question_knowledge_points —— 历年真题（846 道，已有显式/策展关联）
 *
 * 契约：GET /api/exam/408/topic?key=<pointKey> → Exam408Topic
 * 四个数组都按「先章节顺序、再学科内顺序」排好，空数组表示该点暂无该类内容（前端按 section 各自兜底）。
 */

export interface Exam408TopicPoint {
  key: string;
  title: string;
  summary: string;
  body: string[];
  questionCount: number;
  tags: string[];
  subject: { key: string; title: string };
  chapter: { key: string; title: string; chapterNumber: number };
}

export interface Exam408Topic {
  point: Exam408TopicPoint;
  articles: StudyTopicSummary[];
  cards: Exam408CardContent[];
  demos: Exam408DemoSummary[];
  questions: Exam408Question[];
}

export interface Exam408TopicPointRow {
  key: string;
  title: string;
  summary: string;
  body: unknown;
  question_count: number;
  tags: unknown;
  subject_key: string;
  subject_title: string;
  chapter_key: string;
  chapter_title: string;
  chapter_number: number;
}

export interface Exam408TopicArticleRow extends StudyTopicRow {
  key: string;
}

export interface Exam408TopicCardRow {
  key: string;
  subject_key: string;
  chapter: number;
  question: string;
  answer_steps: unknown;
  pitfall: string | null;
  mnemonic: string | null;
  star: boolean | null;
  demo_key: string | null;
  knowledge_point_key: string | null;
}

export interface Exam408TopicDemoRow {
  key: string;
  subject_key: string;
  title: string;
  description: string | null;
  frame_count: number;
  steps_count: number;
  knowledge_point_key: string | null;
}

export interface Exam408TopicQuestionRow {
  key: string;
  question_id: string;
  paper_year: number;
  question_number: number;
  type: "choice" | "comprehensive";
  points: number;
  body: string;
  stem: string;
  options: unknown;
  answer_text: string;
  answer_letter: string | null;
  image_refs: unknown;
  answer_image_refs: unknown;
  video_url: string | null;
  tags: unknown;
  subject_key: string;
  subject_title: string;
  knowledge_points: unknown;
}

async function readPoint(key: string): Promise<Exam408TopicPoint | null> {
  const { rows } = await pgPool.query<Exam408TopicPointRow>(
    `SELECT
       p.key,
       p.title,
       p.summary,
       p.body,
       p.question_count,
       p.tags,
       s.key AS subject_key,
       s.title AS subject_title,
       c.key AS chapter_key,
       c.title AS chapter_title,
       c.chapter_number
     FROM exam_408_knowledge_points p
     JOIN exam_408_subjects s ON s.key = p.subject_key
     JOIN exam_408_chapters c ON c.key = p.chapter_key
     WHERE p.key = $1 AND p.status = 'published'`,
    [key],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    key: row.key,
    title: row.title,
    summary: row.summary,
    body: stringArray(row.body),
    questionCount: Number(row.question_count),
    tags: stringArray(row.tags),
    subject: { key: row.subject_key, title: row.subject_title },
    chapter: {
      key: row.chapter_key,
      title: row.chapter_title,
      chapterNumber: Number(row.chapter_number),
    },
  };
}

async function readArticles(pointKey: string): Promise<StudyTopicSummary[]> {
  const { rows } = await pgPool.query<Exam408TopicArticleRow>(
    `SELECT
       key,
       subject_key,
       chapter,
       chapter_order,
       sort_order,
       slug,
       title,
       importance,
       exam_frequency,
       knowledge_point_key,
       length(content_md)::int AS content_chars
     FROM exam_408_study_topics
     WHERE knowledge_point_key = $1 AND status = 'published'
     ORDER BY chapter_order, sort_order, key`,
    [pointKey],
  );
  return rows.map(mapStudyTopicSummary).sort(compareStudyTopics);
}

async function readCards(pointKey: string): Promise<Exam408CardContent[]> {
  const { rows } = await pgPool.query<Exam408TopicCardRow>(
    `SELECT
       key, subject_key, chapter, question, answer_steps, pitfall, mnemonic, star, demo_key,
       knowledge_point_key
     FROM exam_408_cards
     WHERE knowledge_point_key = $1 AND status = 'published'
     ORDER BY subject_key, chapter, sort_order, key`,
    [pointKey],
  );
  return rows.map(mapCard);
}

async function readDemos(pointKey: string): Promise<Exam408DemoSummary[]> {
  const { rows } = await pgPool.query<Exam408TopicDemoRow>(
    `SELECT
       key,
       subject_key,
       title,
       description,
       frame_count,
       COALESCE(jsonb_array_length(steps), 0) AS steps_count,
       knowledge_point_key
     FROM exam_408_demos
     WHERE knowledge_point_key = $1 AND status = 'published'
     ORDER BY subject_key, sort_order, key`,
    [pointKey],
  );
  return rows.map(mapDemo);
}

async function readQuestions(pointKey: string): Promise<Exam408Question[]> {
  const { rows } = await pgPool.query<Exam408TopicQuestionRow>(
    `SELECT
       q.key,
       q.question_id,
       q.paper_year,
       q.question_number,
       q.type,
       q.points,
       q.body,
       q.stem,
       q.options,
       q.answer_text,
       q.answer_letter,
       q.image_refs,
       q.answer_image_refs,
       q.video_url,
       q.tags,
       s.key AS subject_key,
       s.title AS subject_title,
       COALESCE((
         SELECT jsonb_agg(
           jsonb_build_object('key', p.key, 'title', p.title)
           ORDER BY p.subject_key, p.sort_order
         )
         FROM exam_408_question_knowledge_points link
         JOIN exam_408_knowledge_points p ON p.key = link.knowledge_point_key
         WHERE link.question_key = q.key
       ), '[]'::jsonb) AS knowledge_points
     FROM exam_408_questions q
     JOIN exam_408_subjects s ON s.key = q.subject_key
     JOIN exam_408_question_knowledge_points point_link
       ON point_link.question_key = q.key AND point_link.knowledge_point_key = $1
     WHERE q.status = 'published'
     ORDER BY q.paper_year, q.question_number`,
    [pointKey],
  );
  return rows.map(mapQuestion);
}

export async function getExam408Topic(key: string): Promise<Exam408Topic | null> {
  // 入参兼容两种前缀：库里主键始终是 beokayy-408/*
  const pointKey = internalizePointKey(key);
  const point = await readPoint(pointKey);
  if (!point) return null;
  const [articles, cards, demos, questions] = await Promise.all([
    readArticles(pointKey),
    readCards(pointKey),
    readDemos(pointKey),
    readQuestions(pointKey),
  ]);
  // 返回给前端/App 的 point 类 key 统一换成展示前缀（旧前缀也能被 internalize 回来）
  return {
    point: { ...point, key: externalizePointKey(point.key) },
    articles: articles.map((article) => ({
      ...article,
      knowledgePointKey: article.knowledgePointKey
        ? externalizePointKey(article.knowledgePointKey)
        : null,
    })),
    cards: cards.map((card) => ({
      ...card,
      knowledgePointKey: card.knowledgePointKey ? externalizePointKey(card.knowledgePointKey) : null,
    })),
    demos: demos.map((demo) => ({
      ...demo,
      knowledgePointKey: demo.knowledgePointKey ? externalizePointKey(demo.knowledgePointKey) : null,
    })),
    questions: questions.map((question) => ({
      ...question,
      knowledgePoints: question.knowledgePoints.map((link) => ({
        ...link,
        key: externalizePointKey(link.key),
      })),
    })),
  };
}

export function mapCard(row: Exam408TopicCardRow): Exam408CardContent {
  return {
    key: String(row.key),
    subjectKey: String(row.subject_key),
    chapter: Number(row.chapter) || 0,
    question: String(row.question ?? ""),
    answerSteps: normalizeAnswerSteps(row.answer_steps),
    pitfall: normalizeOptionalText(row.pitfall),
    mnemonic: normalizeOptionalText(row.mnemonic),
    star: Boolean(row.star),
    demoKey: normalizeOptionalText(row.demo_key),
    knowledgePointKey: normalizeOptionalText(row.knowledge_point_key),
  };
}

export function mapDemo(row: Exam408TopicDemoRow): Exam408DemoSummary {
  return {
    key: String(row.key),
    subjectKey: String(row.subject_key),
    title: String(row.title ?? ""),
    description: row.description ?? "",
    frameCount: Number(row.frame_count) || 0,
    stepsCount: Number(row.steps_count) || 0,
    knowledgePointKey: normalizeOptionalText(row.knowledge_point_key),
  };
}

export function mapQuestion(row: Exam408TopicQuestionRow): Exam408Question {
  return {
    key: row.key,
    id: row.question_id,
    year: Number(row.paper_year),
    number: Number(row.question_number),
    type: row.type,
    subject: { key: row.subject_key, title: row.subject_title },
    points: Number(row.points),
    body: row.body,
    stem: row.stem,
    options: optionArray(row.options),
    answerText: row.answer_text,
    answerLetter: row.answer_letter,
    imageRefs: stringArray(row.image_refs),
    answerImageRefs: stringArray(row.answer_image_refs),
    videoUrl: row.video_url,
    tags: stringArray(row.tags),
    knowledgePoints: knowledgePointArray(row.knowledge_points),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionArray(value: unknown): Exam408Question["options"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { letter: unknown; text: unknown } => Boolean(item) && typeof item === "object",
    )
    .map((item) => ({ letter: String(item.letter ?? ""), text: String(item.text ?? "") }))
    .filter((item) => item.letter && item.text);
}

function knowledgePointArray(value: unknown): Exam408Question["knowledgePoints"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { key: unknown; title: unknown } => Boolean(item) && typeof item === "object",
    )
    .map((item) => ({ key: String(item.key ?? ""), title: String(item.title ?? "") }))
    .filter((item) => item.key && item.title);
}