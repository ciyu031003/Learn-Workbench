#!/usr/bin/env node
/**
 * Export one 408 chapter from the local public snapshot into the unified
 * content-package v1 format. This is the repeatable pilot generator; it never
 * writes PostgreSQL and always emits `status: "review"`.
 *
 * Examples:
 *   node scripts/beokayy-408/export-package.mjs --chapter=ds-02
 *   node scripts/beokayy-408/export-package.mjs --chapter=ds-02 --out=.local/beokayy-408/pilots/ds-02.package.json
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  ORIGIN,
  parseArgs,
  readJson,
  resolveOutDir,
  writeJson,
} from "./common.mjs";
import { validateContentPackage } from "../lib/content-package.mjs";

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolveOutDir(args);
const CHAPTER_KEY = String(args.chapter ?? "ds-02").trim();
const SUBJECT_KEY = String(args.subject ?? "data-structure").trim();
const QUESTION_LIMIT = Math.max(1, Number(args["questions-per-point"] ?? 2) || 2);
const OUTPUT = path.resolve(
  args.out ? String(args.out) : path.join(OUT_DIR, "pilots", `${SUBJECT_KEY}-${CHAPTER_KEY}.package.json`),
);

const manifest = await readJson(path.join(OUT_DIR, "raw", "manifest.json"));
const questionsFile = await readJson(path.join(OUT_DIR, "parsed", "questions.json"));
const knowledgeFile = await readJson(path.join(OUT_DIR, "parsed", "knowledge-index.json"));
const questions = questionsFile.questions ?? [];
const subjects = knowledgeFile.subjects ?? [];
const subject = subjects.find((item) => item.key === SUBJECT_KEY);
if (!subject) throw new Error(`Unknown subject: ${SUBJECT_KEY}`);
const chapter = subject.chapters.find((item) => item.key === CHAPTER_KEY);
if (!chapter) throw new Error(`Unknown chapter ${CHAPTER_KEY} in ${SUBJECT_KEY}`);

const questionById = new Map(questions.map((question) => [question.id, question]));
const selectedQuestions = [];
const seenQuestions = new Set();
for (const point of chapter.points) {
  const allLinked = point.questionIds
    .map((id) => questionById.get(id))
    .filter(Boolean);
  const choices = allLinked.filter((question) => question.type === "choice");
  const linked = (choices.length > 0 ? choices : allLinked).slice(0, QUESTION_LIMIT);
  for (const question of linked) {
    if (seenQuestions.has(question.id)) continue;
    seenQuestions.add(question.id);
    selectedQuestions.push(question);
  }
}

if (selectedQuestions.length === 0) {
  throw new Error(`No choice questions found for ${SUBJECT_KEY}/${CHAPTER_KEY}.`);
}

const pointKey = (value) => `beokayy-408/${value}`;
const questionKey = (value) => `beokayy-408/${value}`;
const packageValue = {
  formatVersion: 1,
  packageKey: `beokayy-408-${SUBJECT_KEY}-${CHAPTER_KEY}-pilot`,
  title: `408 ${subject.label} · ${chapter.title}（内容试点）`,
  domain: "exam-408",
  status: "review",
  source: {
    key: "beokayy-408",
    name: "四〇八档案室 · 408 历年真题",
    url: `${ORIGIN}/`,
    license: "站点未声明开源或转载许可；仅个人、非商业、本地学习使用，不再分发。",
    usage: "personal-study",
    ref: String(manifest.discovery?.bundleUrl ?? manifest.capturedAt ?? ""),
    capturedAt: String(manifest.capturedAt ?? ""),
  },
  course: {
    key: "ex-408-grad",
    title: "408 知识点精讲 · 历年真题",
    category: "408",
  },
  chapters: [
    {
      key: pointKey(chapter.key),
      title: chapter.title,
      subjectKey: pointKey(subject.key),
      subjectTitle: subject.label,
      chapterNumber: Number(chapter.number),
      points: chapter.points.map((point) => ({
        key: pointKey(point.key),
        title: point.title,
        summary: `${subject.label} · ${chapter.title}`,
        tags: [subject.label, chapter.title, point.title],
        sourceUrl: subject.sourceUrl,
      })),
    },
  ],
  questions: selectedQuestions.map((question) => ({
    key: questionKey(question.id),
    externalId: question.id,
    type: question.type === "choice" ? "choice" : "comprehensive",
    subjectKey: pointKey(question.subject === subject.label ? subject.key : SUBJECT_KEY),
    year: Number(question.year),
    number: Number(question.number),
    pointsPossible: Number(question.points),
    prompt: question.type === "choice" ? question.stem || question.body : question.body,
    options: question.type === "choice" ? question.options : [],
    answer: {
      choice: question.answerLetter ?? "",
      text: question.answerText,
    },
    knowledgePointKeys: chapter.points
      .filter((point) => point.questionIds.includes(question.id))
      .map((point) => pointKey(point.key)),
    tags: question.tags ?? [],
    sourceUrl: question.sourceUrl,
  })),
  review: {
    status: "pending",
    reviewer: "",
    reviewedAt: "",
    note: "由 408 快照生成，人工复核后才允许发布。",
  },
};

const validation = validateContentPackage(packageValue, { strict: true });
if (!validation.ok) {
  console.error(validation.errors.join("\n"));
  throw new Error("Generated package failed validation.");
}
await writeJson(OUTPUT, packageValue);

console.log(
  [
    "[beokayy-408] package exported",
    `subject=${subject.key}`,
    `chapter=${chapter.key}`,
    `points=${validation.stats.points}`,
    `questions=${validation.stats.questions}`,
    `links=${validation.stats.links}`,
    `fingerprint=${validation.fingerprint.slice(0, 12)}`,
    `file=${path.relative(process.cwd(), OUTPUT)}`,
  ].join(" "),
);
