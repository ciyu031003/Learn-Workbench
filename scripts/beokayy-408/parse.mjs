#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import {
  ORIGIN,
  SUBJECTS,
  decodeHtml,
  extractAnswerLetter,
  parseArgs,
  parseQuestionBody,
  readJson,
  resolveOutDir,
  sourceUrl,
  stripTags,
  writeJson,
} from "./common.mjs";

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const MANIFEST_FILE = path.join(OUT_DIR, "raw", "manifest.json");
const PARSED_DIR = path.join(OUT_DIR, "parsed");

async function main() {
  const manifest = await readJson(MANIFEST_FILE);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const bundleEntry = findEntry(entries, "data-bundle");
  if (!bundleEntry) {
    throw new Error("No data-bundle entry found. Run crawl.mjs first.");
  }

  const bundleText = await readFile(bundleEntry.file, "utf8");
  const bundle = extractDataBundle(bundleText);
  const papers = normalizePapers(bundle.papers);
  const questions = papers.flatMap((paper) => paper.questions);
  const knowledge = await parseKnowledge(entries);

  const parseSummary = {
    version: 1,
    parsedAt: new Date().toISOString(),
    bundleUrl: bundleEntry.url,
    availableYears: bundle.availableYears,
    paperCount: papers.length,
    questionCount: questions.length,
    choiceCount: questions.filter((question) => question.type === "choice").length,
    comprehensiveCount: questions.filter(
      (question) => question.type === "comprehensive",
    ).length,
    imageQuestionCount: questions.filter((question) => question.imageRefs.length > 0)
      .length,
    knowledgeSubjects: knowledge.map((subject) => ({
      key: subject.key,
      label: subject.label,
      chapters: subject.chapters.length,
      points: subject.chapters.reduce(
        (total, chapter) => total + chapter.points.length,
        0,
      ),
      questionLinks: subject.chapters.reduce(
        (total, chapter) =>
          total +
          chapter.points.reduce(
            (pointTotal, point) => pointTotal + point.questionIds.length,
            0,
          ),
        0,
      ),
    })),
  };

  await writeJson(path.join(PARSED_DIR, "papers.json"), {
    version: 1,
    source: {
      origin: ORIGIN,
      bundleUrl: bundleEntry.url,
      capturedAt: manifest.capturedAt,
      bundleSha256: bundleEntry.sha256,
    },
    papers: papers.map(({ questions: _questions, ...paper }) => paper),
  });

  await writeJson(path.join(PARSED_DIR, "questions.json"), {
    version: 1,
    source: {
      origin: ORIGIN,
      bundleUrl: bundleEntry.url,
      capturedAt: manifest.capturedAt,
      bundleSha256: bundleEntry.sha256,
    },
    questions,
  });

  await writeJson(path.join(PARSED_DIR, "knowledge-index.json"), {
    version: 1,
    source: { origin: ORIGIN, capturedAt: manifest.capturedAt },
    subjects: knowledge,
  });

  await writeJson(path.join(PARSED_DIR, "parse-summary.json"), parseSummary);

  console.log(
    [
      "[beokayy-408] parse complete",
      `years=${parseSummary.paperCount}`,
      `questions=${parseSummary.questionCount}`,
      `choice=${parseSummary.choiceCount}`,
      `comprehensive=${parseSummary.comprehensiveCount}`,
      `imageQuestions=${parseSummary.imageQuestionCount}`,
      `knowledgeSubjects=${parseSummary.knowledgeSubjects.length}`,
    ].join(" "),
  );
}

function findEntry(entries, kind) {
  return entries.find((entry) => entry.kind === kind && entry.status === 200);
}

function extractDataBundle(source) {
  const marker = source.indexOf("availableYears");
  if (marker < 0) {
    throw new Error("The data bundle does not contain availableYears.");
  }

  const declaration = source.lastIndexOf("var ", marker);
  const start = source.indexOf("{", declaration);
  if (declaration < 0 || start < 0) {
    throw new Error("Unable to locate the data object literal.");
  }

  const end = findMatchingBrace(source, start);
  if (end < 0) {
    throw new Error("Unable to find the end of the data object literal.");
  }

  const literal = source.slice(start, end + 1);
  const value = vm.runInNewContext(`(${literal})`, Object.create(null), {
    timeout: 3000,
    contextCodeGeneration: {
      strings: false,
      wasm: false,
    },
  });

  if (!Array.isArray(value.availableYears) || !Array.isArray(value.papers)) {
    throw new Error("The extracted data object has an unexpected shape.");
  }
  return value;
}

function findMatchingBrace(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function normalizePapers(rawPapers) {
  if (!Array.isArray(rawPapers)) return [];

  return rawPapers
    .map((paper) => {
      const questions = normalizeQuestions(paper.questions);
      const sections = buildSections(questions);
      return {
        year: Number(paper.year),
        title: `${paper.year} 年 408 真题`,
        totalScore: Number(paper.validation?.totalPoints ?? 0),
        typeCounts: { ...(paper.validation?.typeCounts ?? {}) },
        subjectCounts: { ...(paper.validation?.subjectCounts ?? {}) },
        validation: { ...(paper.validation?.validation ?? {}) },
        sections,
        questionIds: questions.map((question) => question.id),
        questions,
      };
    })
    .sort((left, right) => left.year - right.year);
}

function normalizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((question) => {
      const body = String(question.body ?? "");
      const parsed = parseQuestionBody(body);
      return {
        id: String(question.id ?? ""),
        year: Number(question.year),
        number: Number(question.number),
        type: String(question.type ?? ""),
        subject: String(question.subject ?? ""),
        points: Number(question.points ?? 0),
        tags: Array.isArray(question.tags) ? question.tags.map(String) : [],
        body,
        stem: parsed.stem,
        options: parsed.options,
        optionSource: parsed.optionSource,
        optionCount: Number(question.optionCount ?? parsed.options.length),
        answerText: String(question.answer ?? ""),
        answerLetter:
          question.type === "choice"
            ? extractAnswerLetter(String(question.answer ?? ""))
            : null,
        imageRefs: Array.isArray(question.imageRefs)
          ? question.imageRefs.map(String)
          : [],
        answerImageRefs: Array.isArray(question.answerImageRefs)
          ? question.answerImageRefs.map(String)
          : [],
        hasImage: Boolean(question.hasImage),
        videoUrl: question.videoUrl ? String(question.videoUrl) : null,
        videoPOffset: Number(question.videoPOffset ?? 0),
        missingFields: Array.isArray(question.missingFields)
          ? question.missingFields.map(String)
          : [],
        sourceUrl: sourceUrl(`/question/${question.id}`),
      };
    })
    .sort((left, right) => left.year - right.year || left.number - right.number);
}

function buildSections(questions) {
  const groups = [];
  for (const question of questions) {
    const previous = groups.at(-1);
    if (!previous || previous.type !== question.type) {
      groups.push({
        type: question.type,
        title: question.type === "choice" ? "单项选择题" : "综合应用题",
        from: question.number,
        to: question.number,
        questionIds: [question.id],
        totalScore: question.points,
      });
      continue;
    }
    previous.to = question.number;
    previous.questionIds.push(question.id);
    previous.totalScore += question.points;
  }
  return groups;
}

async function parseKnowledge(entries) {
  const subjects = [];

  for (const subject of SUBJECTS) {
    const entry = entries.find(
      (item) =>
        item.kind === "knowledge" &&
        item.url === sourceUrl(`/knowledge?subject=${subject.key}`),
    );
    if (!entry) continue;

    const html = await readFile(entry.file, "utf8");
    const chapters = parseKnowledgeChapters(html, subject);
    subjects.push({
      key: subject.key,
      short: subject.short,
      label: subject.label,
      sourceUrl: entry.url,
      chapters,
    });
  }

  return subjects;
}

function parseKnowledgeChapters(html, subject) {
  const chapters = [];
  const chapterPattern =
    /<article class="knowledge-chapter-card">([\s\S]*?)<\/article>/g;

  for (const chapterMatch of html.matchAll(chapterPattern)) {
    const content = chapterMatch[1];
    const header = content.match(
      /<header><span>(\d+)<\/span><h3>([\s\S]*?)<\/h3><\/header>/,
    );
    if (!header) continue;

    const chapterNumber = Number(header[1]);
    const chapterKey = `${subject.short.toLowerCase()}-${String(chapterNumber).padStart(2, "0")}`;
    const points = [];
    const pointPattern =
      /<div class="knowledge-point-entry" id="point-([^"]+)">([\s\S]*?)(?=<div class="knowledge-point-entry"|<\/article>|$)/g;

    for (const pointMatch of content.matchAll(pointPattern)) {
      const pointKey = pointMatch[1];
      const pointContent = pointMatch[2];
      const label = pointContent.match(
        /<span class="knowledge-point-label">([\s\S]*?)<\/span>/,
      );
      const count = pointContent.match(/<small>(\d+)<!-- --> 题<\/small>/);
      const questionIds = [];

      for (const link of pointContent.matchAll(
        /href="\/question\/(\d{4}-\d{2})\?from=knowledge&amp;point=/g,
      )) {
        if (!questionIds.includes(link[1])) questionIds.push(link[1]);
      }

      points.push({
        key: pointKey,
        title: stripTags(label?.[1] ?? ""),
        declaredQuestionCount: Number(count?.[1] ?? questionIds.length),
        questionIds,
      });
    }

    chapters.push({
      key: chapterKey,
      number: chapterNumber,
      title: decodeHtml(stripTags(header[2])),
      points,
    });
  }

  return chapters;
}

await main();
