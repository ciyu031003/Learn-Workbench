#!/usr/bin/env node
/**
 * 数据库 → 内容包 回写（075/076 闭环的另一半）。
 *
 * 背景：075 之后内容可从后台（/settings/content）直接改库；076 保证同步不会覆盖人工改动。
 * 但改完只活在库里 —— 库丢了就没有了，git 里也看不到 diff。这个脚本把**人工编辑过的行**
 * 导出成 `packages/content/src/learning/content-overrides.ts`（自动生成，勿手改），
 * 于是：改库 → 导出 → 进 git（版本化/可回滚）→ 内容包也带上这份内容。
 *
 * 用法：
 *   node scripts/export-content-from-db.mjs            # 导出人工编辑过的行
 *   node scripts/export-content-from-db.mjs --all      # 导出全量内容（首次建快照用，文件会很大）
 *   node scripts/export-content-from-db.mjs --check    # 只检查是否有差异（有则 exit 1，给 CI/发布闸门用）
 *
 * 环境变量：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD（默认本机 Learn-Workbench）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "packages/content/src/learning/content-overrides.ts");

const args = new Set(process.argv.slice(2));
const ALL = args.has("--all");
const CHECK = args.has("--check");

const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "Learn-Workbench",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || undefined,
});

const q = (value) => JSON.stringify(value);

function renderQuestions(rows) {
  if (rows.length === 0) return "{}";
  const lines = rows.map((row) => {
    const options = row.options.map((option) => "      { key: " + q(option.key) + ", text: " + q(option.text) + " }").join(",\n");
    return (
      "  " + q(row.key) + ": {\n" +
      "    stem: " + q(row.stem) + ",\n" +
      "    options: [\n" + options + ",\n    ],\n" +
      "    answer: " + q(row.answer) + ",\n" +
      "    explanation: " + q(row.explanation) + ",\n" +
      "    tags: " + q(row.tags) + ",\n" +
      "    difficulty: " + q(row.difficulty) + ",\n" +
      "    level: " + (row.level === null ? "null" : q(row.level)) + ",\n" +
      "    type: " + q(row.type) + ",\n" +
      "  },"
    );
  });
  return "{\n" + lines.join("\n") + "\n}";
}

function renderTopics(rows) {
  if (rows.length === 0) return "{}";
  const lines = rows.map((row) => {
    const lesson = row.lesson === null || row.lesson === undefined ? "null" : JSON.stringify(row.lesson);
    return (
      "  " + q(row.track_slug + "::" + row.key) + ": {\n" +
      "    title: " + q(row.title) + ",\n" +
      "    summary: " + q(row.summary) + ",\n" +
      "    concepts: " + q(row.concepts) + ",\n" +
      "    principles: " + q(row.principles) + ",\n" +
      "    applications: " + q(row.applications) + ",\n" +
      "    pitfalls: " + q(row.pitfalls) + ",\n" +
      "    method: " + q(row.method) + ",\n" +
      "    exercise: " + q(row.exercise) + ",\n" +
      "    checkpoint: " + q(row.checkpoint) + ",\n" +
      "    lesson: " + lesson + ",\n" +
      "  },"
    );
  });
  return "{\n" + lines.join("\n") + "\n}";
}

const HEADER = `/**
 * 数据库 → 内容包 回写（**自动生成，勿手改**）。
 *
 * 由 \`node scripts/export-content-from-db.mjs\` 生成：把数据库里
 * \`manually_edited_at IS NOT NULL\`（后台 /settings/content 改过）的题目与知识点
 * 导出成 overrides，内容包在 \`expandLearningTrack\` 之后应用它们。
 *
 * 这样做的意义：后台改的内容不会只活在数据库里 —— 导出后进 git，
 * 既拿到版本化与可回滚，又让「内容包 → 库」的同步不会因为分叉而互相覆盖。
 */
import type {
  LearningDifficulty,
  LearningLevel,
  LearningQuestionOption,
  LearningQuestionType,
  LearningTopicLesson,
} from "./types";

export interface QuestionOverrideRow {
  stem: string;
  options: LearningQuestionOption[];
  answer: string[];
  explanation: string;
  tags: string[];
  difficulty: LearningDifficulty;
  level: LearningLevel | null;
  type: LearningQuestionType;
}

export interface TopicOverrideRow {
  title: string;
  summary: string;
  concepts: string[];
  principles: string[];
  applications: string[];
  pitfalls: string[];
  method: string;
  exercise: string;
  checkpoint: string;
  lesson: LearningTopicLesson | null;
}

`;

function render(questions, topics, exportedAt) {
  return (
    HEADER +
    "// 本次导出：" + exportedAt + "（题目 " + questions.length + " / 知识点 " + topics.length + "）\n" +
    "/** 题目覆盖：key → 整行内容（数据库为准） */\n" +
    "export const questionOverrides: Record<string, QuestionOverrideRow> = " + renderQuestions(questions) + ";\n\n" +
    "/** 知识点覆盖：\`<trackSlug>::<topicKey>\` → 整行内容 */\n" +
    "export const topicOverrides: Record<string, TopicOverrideRow> = " + renderTopics(topics) + ";\n"
  );
}

async function main() {
  const filter = ALL ? "" : " WHERE manually_edited_at IS NOT NULL";
  const questionRes = await pool.query(
    "SELECT key, stem, options, answer, explanation, tags, difficulty, level, type FROM learning_questions" +
      filter + " ORDER BY track_slug, sort_order, key"
  );
  const topicRes = await pool.query(
    "SELECT track_slug, key, title, summary, concepts, principles, applications, pitfalls, method, exercise, checkpoint, lesson FROM learning_topics" +
      filter + " ORDER BY track_slug, sort_order, key"
  );

  const next = render(questionRes.rows, topicRes.rows, new Date().toISOString());
  const current = readFileSync(TARGET, "utf8");

  if (CHECK) {
    if (normalize(next) !== normalize(current)) {
      console.error("[content-export] 存在未导出的数据库改动：" + questionRes.rows.length + " 题 / " + topicRes.rows.length + " 知识点");
      console.error("[content-export] 跑 node scripts/export-content-from-db.mjs 导出后再提交");
      process.exitCode = 1;
      return;
    }
    console.log("[content-export] 无差异（题目 " + questionRes.rows.length + " / 知识点 " + topicRes.rows.length + "）");
    return;
  }

  // 时间戳不参与"是否有变化"的判断，但每次导出都会更新它 —— 只有内容真变了才写文件
  if (normalize(next) === normalize(current)) {
    console.log("[content-export] 无变化，未改动文件（题目 " + questionRes.rows.length + " / 知识点 " + topicRes.rows.length + "）");
    return;
  }
  writeFileSync(TARGET, next, "utf8");
  console.log("[content-export] 已写入 " + path.relative(ROOT, TARGET) + "：题目 " + questionRes.rows.length + " / 知识点 " + topicRes.rows.length);
}

/** 去掉时间戳行后比较，避免"只是重新导出"就产生 diff */
function normalize(text) {
  return text.replace(/^\/\/ 本次导出：.*$/gm, "");
}

await main()
  .catch((error) => {
    console.error("[content-export] 失败：" + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
