import { getApiUrl } from "@/config";
import type { Exam408Question } from "@/lib/exam-408";
import type { Exam408DemoSummary } from "@/lib/exam-408-demos";
import {
  normalizeStudySummary,
  type Exam408StudyArticleSummary,
} from "@/lib/exam-408-study";

/**
 * 408 知识点聚合（v1.55）：一个知识点同时挂「精读文章 / 速记卡 / 交互演示 / 历年真题」。
 *
 * 契约与 Web 端 `lib/exam-408-topic.ts` 同源：
 *   GET /api/exam/408/topic?key=<pointKey>
 *   → { point, articles: StudyTopicSummary[], cards: CardContent[], demos: DemoSummary[], questions: Question[] }
 *
 * App 端当前只消费 articles / cards / demos 的数量与标题（知识点页的「延伸内容」入口区块），
 * 但四段都做归一化：老数据可能缺字段、服务端也可能把 snake_case 混进来，入口区块不能因此白屏。
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

export interface Exam408TopicCard {
  key: string;
  subjectKey: string;
  chapter: number;
  question: string;
  answerSteps: string[];
  pitfall: string | null;
  mnemonic: string | null;
  star: boolean;
  demoKey: string | null;
  knowledgePointKey: string | null;
}

export interface Exam408Topic {
  point: Exam408TopicPoint;
  articles: Exam408StudyArticleSummary[];
  cards: Exam408TopicCard[];
  demos: Exam408DemoSummary[];
  questions: Exam408Question[];
}

export interface Exam408TopicCounts {
  articles: number;
  cards: number;
  demos: number;
}

/** 入口区块的三个计数（空/缺省按 0） */
export function exam408TopicCounts(topic: Exam408Topic | null): Exam408TopicCounts {
  return {
    articles: topic?.articles.length ?? 0,
    cards: topic?.cards.length ?? 0,
    demos: topic?.demos.length ?? 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function textOrNull(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed.length > 0 ? trimmed : null;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizePoint(value: unknown): Exam408TopicPoint | null {
  const raw = asRecord(value);
  const key = text(raw.key);
  const title = text(raw.title);
  if (!key || !title) return null;
  const subject = asRecord(raw.subject);
  const chapter = asRecord(raw.chapter);
  return {
    key,
    title,
    summary: text(raw.summary),
    body: stringList(raw.body),
    questionCount: numberValue(raw.questionCount ?? raw.question_count),
    tags: stringList(raw.tags),
    subject: {
      key: text(subject.key ?? raw.subject_key),
      title: text(subject.title ?? raw.subject_title),
    },
    chapter: {
      key: text(chapter.key ?? raw.chapter_key),
      title: text(chapter.title ?? raw.chapter_title),
      chapterNumber: numberValue(chapter.chapterNumber ?? chapter.chapter_number ?? raw.chapter_number),
    },
  };
}

function normalizeCard(value: unknown): Exam408TopicCard | null {
  const raw = asRecord(value);
  const key = text(raw.key);
  if (!key) return null;
  return {
    key,
    subjectKey: text(raw.subjectKey ?? raw.subject_key),
    chapter: numberValue(raw.chapter),
    question: text(raw.question),
    answerSteps: stringList(raw.answerSteps ?? raw.answer_steps),
    pitfall: textOrNull(raw.pitfall),
    mnemonic: textOrNull(raw.mnemonic),
    star: raw.star === true || raw.star === "true",
    demoKey: textOrNull(raw.demoKey ?? raw.demo_key),
    knowledgePointKey: textOrNull(raw.knowledgePointKey ?? raw.knowledge_point_key),
  };
}

function normalizeDemo(value: unknown): Exam408DemoSummary | null {
  const raw = asRecord(value);
  const key = text(raw.key);
  if (!key) return null;
  return {
    key,
    subjectKey: text(raw.subjectKey ?? raw.subject_key),
    title: text(raw.title),
    description: text(raw.description),
    frameCount: numberValue(raw.frameCount ?? raw.frame_count),
    stepsCount: numberValue(raw.stepsCount ?? raw.steps_count),
    knowledgePointKey: textOrNull(raw.knowledgePointKey ?? raw.knowledge_point_key),
  };
}

function normalizeOption(value: unknown): { letter: string; text: string } | null {
  const raw = asRecord(value);
  const letter = text(raw.letter);
  const optionText = text(raw.text);
  return letter && optionText ? { letter, text: optionText } : null;
}

function normalizeQuestion(value: unknown): Exam408Question | null {
  const raw = asRecord(value);
  const key = text(raw.key);
  const id = text(raw.id);
  if (!key || !id) return null;
  const subject = asRecord(raw.subject);
  const type = raw.type === "comprehensive" ? "comprehensive" : "choice";
  return {
    key,
    id,
    year: numberValue(raw.year),
    number: numberValue(raw.number),
    type,
    subject: { key: text(subject.key), title: text(subject.title) },
    points: numberValue(raw.points),
    body: text(raw.body),
    stem: text(raw.stem),
    options: Array.isArray(raw.options)
      ? raw.options
          .map((item) => normalizeOption(item))
          .filter((item): item is { letter: string; text: string } => item !== null)
      : [],
    answerText: text(raw.answerText ?? raw.answer_text),
    answerLetter: textOrNull(raw.answerLetter ?? raw.answer_letter),
    imageRefs: stringList(raw.imageRefs ?? raw.image_refs),
    answerImageRefs: stringList(raw.answerImageRefs ?? raw.answer_image_refs),
    videoUrl: textOrNull(raw.videoUrl ?? raw.video_url),
    tags: stringList(raw.tags),
    knowledgePoints: Array.isArray(raw.knowledgePoints)
      ? raw.knowledgePoints.flatMap((item) => {
          const link = asRecord(item);
          const linkKey = text(link.key);
          return linkKey ? [{ key: linkKey, title: text(link.title) }] : [];
        })
      : [],
  };
}

/** 服务端聚合体归一化；不是对象或缺少 point.key/title 时返回 null（调用方按「无延伸内容」处理） */
export function normalizeExam408Topic(value: unknown): Exam408Topic | null {
  const raw = asRecord(value);
  const point = normalizePoint(raw.point);
  if (!point) return null;

  const articles = Array.isArray(raw.articles)
    ? raw.articles
        .map((item) => normalizeStudySummary(item, point.subject.key || ""))
        .filter((item) => item.slug)
    : [];
  const cards = Array.isArray(raw.cards)
    ? raw.cards.map(normalizeCard).filter((item): item is Exam408TopicCard => item !== null)
    : [];
  const demos = Array.isArray(raw.demos)
    ? raw.demos.map(normalizeDemo).filter((item): item is Exam408DemoSummary => item !== null)
    : [];
  const questions = Array.isArray(raw.questions)
    ? raw.questions.map(normalizeQuestion).filter((item): item is Exam408Question => item !== null)
    : [];

  return { point, articles, cards, demos, questions };
}

const KEY_PREFIX = "beokayy-408/";

/** 知识点聚合：404 / 非 2xx / 结构不可识别都抛 Error，由知识点页静默降级（入口区块不渲染） */
export async function getExam408Topic(key: string): Promise<Exam408Topic> {
  const trimmed = key.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) {
    throw new Error("key 必须是 408 知识点 key");
  }
  const url =
    getApiUrl().replace(/\/+$/, "") + "/api/exam/408/topic?key=" + encodeURIComponent(trimmed);
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("网络不可用，暂时加载不到延伸内容");
  }
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 保持默认错误文案
    }
    throw new Error(message);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("知识点聚合数据不可用");
  }
  const topic = normalizeExam408Topic(payload);
  if (!topic) throw new Error("知识点聚合数据不可用");
  return topic;
}
