import { describe, expect, it } from "vitest";

import { learningTracks } from "./index";
import { EXAM408_DEEP_CHAPTER_KEYS, exam408DeepLessons } from "./exam-408-grad-deep";

/**
 * ex-408-grad「加深层」内容契约（2026-11 408 讲义扩容）。
 *
 * 目的：25 个章级知识点必须真的被扩写到可当教材读的深度 ——
 * 段落数、背诵小结、术语、易错点、篇幅都有下限；任何一章漏写、写空、
 * 写重复、写进 HTML 都会在这里当场拦下，而不是等同步进库后被用户看到。
 */

const TRACK_SLUG = "ex-408-grad";
const track = learningTracks.find((item) => item.slug === TRACK_SLUG)!;

/** 并行写作时按科目过滤（ds/co/os/net），只影响断言范围，不影响产物。 */
const ONLY = (process.env.EXAM408_DEEP_ONLY ?? "").trim();
const CHAPTER_KEYS = ONLY
  ? EXAM408_DEEP_CHAPTER_KEYS.filter((key) => key.includes(ONLY))
  : EXAM408_DEEP_CHAPTER_KEYS;

/** 单个字段的硬性下限（按章）。 */
const MIN = {
  overview: 3,
  mechanism: 18,
  summary: 8,
  terms: 4,
  pitfalls: 5,
  /** 「深入理解 + 运作机制」新增正文的非空白字符数下限 */
  chars: 3200,
} as const;

const MAX_PARAGRAPH = 400;
const MIN_PARAGRAPH = 20;

function topicOf(chapterKey: string) {
  for (const stage of track.stages) {
    const topic = stage.topics.find((item) => item.key === chapterKey);
    if (topic) return topic;
  }
  return undefined;
}

function countChars(texts: string[]): number {
  return texts.join("").replace(/\s+/g, "").length;
}

const DANGEROUS = /<\s*(script|iframe|object|embed|style|link|meta)\b|on(error|load|click)\s*=|\bjavascript:/i;
const MARKDOWN_FENCE = /\`\`\`/;

describe("加深层章节覆盖", () => {
  it("恰好覆盖 25 个章级知识点，key 与轨道一一对应", () => {
    if (ONLY) return; // 并行写作时不校验全量
    const expected = [...EXAM408_DEEP_CHAPTER_KEYS].sort();
    const actual = Object.keys(exam408DeepLessons).sort();
    expect(actual).toEqual(expected);
    expect(expected.length).toBe(25);
    for (const key of expected) {
      expect(topicOf(key), `轨道里找不到章节 ${key}`).toBeTruthy();
    }
  });

  it("每章的段落数量与篇幅达到下限", () => {
    for (const key of CHAPTER_KEYS) {
      const deep = exam408DeepLessons[key];
      expect(deep, `缺少加深内容：${key}`).toBeTruthy();
      expect(deep.overview?.length ?? 0, `${key} overview 段数不足`).toBeGreaterThanOrEqual(MIN.overview);
      expect(deep.mechanism?.length ?? 0, `${key} mechanism 段数不足`).toBeGreaterThanOrEqual(MIN.mechanism);
      expect(deep.summary?.length ?? 0, `${key} summary 条数不足`).toBeGreaterThanOrEqual(MIN.summary);
      expect(deep.terms?.length ?? 0, `${key} terms 条数不足`).toBeGreaterThanOrEqual(MIN.terms);
      expect(deep.pitfalls?.length ?? 0, `${key} pitfalls 条数不足`).toBeGreaterThanOrEqual(MIN.pitfalls);
      const chars = countChars([...(deep.overview ?? []), ...(deep.mechanism ?? [])]);
      expect(chars, `${key} 新增正文只有 ${chars} 字`).toBeGreaterThanOrEqual(MIN.chars);
    }
  });

  it("合并后讲义确实变长（合并函数在 index.ts 里生效）", () => {
    for (const key of CHAPTER_KEYS) {
      const topic = topicOf(key)!;
      const lesson = topic.lesson!;
      expect(lesson, `${key} 缺 lesson`).toBeTruthy();
      expect(lesson.overview.length, `${key} 合并后深入理解段数`).toBeGreaterThanOrEqual(MIN.overview);
      expect(lesson.mechanism.length, `${key} 合并后运作机制段数`).toBeGreaterThanOrEqual(MIN.mechanism);
      expect(lesson.summary?.length ?? 0, `${key} 合并后小结`).toBeGreaterThanOrEqual(MIN.summary);
      expect(lesson.terms?.length ?? 0, `${key} 合并后术语`).toBeGreaterThanOrEqual(MIN.terms);
      expect(topic.pitfalls.length, `${key} 合并后误区`).toBeGreaterThanOrEqual(MIN.pitfalls);
    }
  });
});

describe("加深层文本质量", () => {
  it("段落长度合理，无空段、无 Markdown 代码围栏、无危险 HTML", () => {
    for (const key of CHAPTER_KEYS) {
      const deep = exam408DeepLessons[key];
      const paragraphs = [...(deep.overview ?? []), ...(deep.mechanism ?? []), ...(deep.summary ?? []), ...(deep.pitfalls ?? [])];
      for (const paragraph of paragraphs) {
        const text = paragraph.trim();
        expect(text.length, `${key} 有空段落`).toBeGreaterThan(0);
        expect(text.length, `${key} 段落过长（${text.length} 字）`).toBeLessThanOrEqual(MAX_PARAGRAPH);
        if (!(deep.summary ?? []).includes(paragraph)) {
          expect(text.length, `${key} 段落过短：${text}`).toBeGreaterThanOrEqual(MIN_PARAGRAPH);
        }
        expect(DANGEROUS.test(text), `${key} 含危险片段：${text.slice(0, 40)}`).toBe(false);
        expect(MARKDOWN_FENCE.test(text), `${key} 含代码围栏`).toBe(false);
      }
    }
  });

  it("术语有名字、有白话解释，且同章不重复", () => {
    for (const key of CHAPTER_KEYS) {
      const terms = exam408DeepLessons[key].terms ?? [];
      const names = new Set<string>();
      for (const term of terms) {
        expect(term.term.trim(), `${key} 术语缺名字`).not.toBe("");
        expect(term.plain.trim(), `${key} 术语 ${term.term} 缺白话解释`).not.toBe("");
        expect(term.plain.length, `${key} 术语 ${term.term} 白话过长`).toBeLessThanOrEqual(100);
        expect(names.has(term.term), `${key} 术语重复：${term.term}`).toBe(false);
        names.add(term.term);
      }
    }
  });

  it("跨章不出现重复段落（防止复制粘贴充数）", () => {
    const seen = new Map<string, string>();
    for (const key of CHAPTER_KEYS) {
      const deep = exam408DeepLessons[key];
      for (const paragraph of [...(deep.overview ?? []), ...(deep.mechanism ?? []), ...(deep.summary ?? [])]) {
        const normalized = paragraph.replace(/\s+/g, "");
        const previous = seen.get(normalized);
        expect(previous, `${key} 与 ${previous} 有重复段落：${paragraph.slice(0, 30)}`).toBeUndefined();
        seen.set(normalized, key);
      }
    }
  });
});
