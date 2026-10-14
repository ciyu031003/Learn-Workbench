/**
 * 内容编辑（后台）：改题库 / 知识点的**单一入口**（075 之后内容在库里，改完前台立即生效）。
 *
 * 设计口径：
 *   - 校验按**合并后的整行**做（库里现有值 + 本次 patch），而不是只看 patch ——
 *     否则单独把 type 改成 judge、或只换 options，会留下"答案不在选项里"这类脏数据；
 *   - 字段白名单 + 长度上限，拒绝任何未声明字段（防越权写 sort_order/fingerprint 等内部列）；
 *   - 写库后清进程内内容缓存，前台下一跳就是新内容。
 */
import { pgPool } from "@/lib/db";
import { invalidateLearningTracksCache } from "@/lib/content/learning-repo";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const LEVELS = ["入门", "进阶", "综合"] as const;
const TYPES = ["single", "judge"] as const;
const STATUSES = ["draft", "review", "published", "archived"] as const;

export interface QuestionRowFull {
  key: string;
  track_slug: string;
  stage_key: string;
  topic_key: string | null;
  type: string;
  difficulty: string;
  level: string | null;
  status: string;
  stem: string;
  options: { key: string; text: string }[];
  answer: string[];
  explanation: string;
  tags: string[];
  source_key: string | null;
  updated_at: string;
}

export type PatchResult = { ok: true } | { ok: false; error: string };

function str(value: unknown, field: string, max: number, min = 1): string | { error: string } {
  if (typeof value !== "string") return { error: field + " 必须是字符串" };
  const trimmed = value.trim();
  if (trimmed.length < min) return { error: field + " 不能为空" };
  if (trimmed.length > max) return { error: field + " 超过 " + max + " 字上限" };
  return trimmed;
}

function stringList(value: unknown, field: string, maxItems: number, maxLen: number): string[] | { error: string } {
  if (!Array.isArray(value)) return { error: field + " 必须是字符串数组" };
  if (value.length > maxItems) return { error: field + " 最多 " + maxItems + " 条" };
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return { error: field + " 只能包含字符串" };
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLen) return { error: field + " 单条超过 " + maxLen + " 字" };
    out.push(trimmed);
  }
  return out;
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

/** 校验合并后的题目行（type/options/answer 三者必须自洽）。 */
export function validateQuestion(row: {
  type: string; status: string; stem: string; explanation: string;
  options: { key: string; text: string }[]; answer: string[];
  difficulty: string; level: string | null; tags: string[];
}): PatchResult {
  if (!TYPES.includes(row.type as (typeof TYPES)[number])) return { ok: false, error: "题型必须是 single / judge" };
  if (!STATUSES.includes(row.status as (typeof STATUSES)[number])) return { ok: false, error: "状态不合法" };
  if (!DIFFICULTIES.includes(row.difficulty as (typeof DIFFICULTIES)[number])) return { ok: false, error: "难度必须是 easy / medium / hard" };
  if (row.level !== null && !LEVELS.includes(row.level as (typeof LEVELS)[number])) return { ok: false, error: "分级必须是 入门 / 进阶 / 综合" };
  if (!row.stem.trim()) return { ok: false, error: "题干不能为空" };
  if (!Array.isArray(row.options) || row.options.length < 2) return { ok: false, error: "至少需要 2 个选项" };
  if (row.options.length > 8) return { ok: false, error: "最多 8 个选项" };
  const optionKeys = new Set<string>();
  for (const option of row.options) {
    if (typeof option?.key !== "string" || typeof option?.text !== "string") return { ok: false, error: "选项必须是 {key,text}" };
    const key = option.key.trim();
    if (!key || key.length > 4) return { ok: false, error: "选项 key 必须 1-4 个字符" };
    if (optionKeys.has(key)) return { ok: false, error: "选项 key 重复：" + key };
    if (!option.text.trim()) return { ok: false, error: "选项内容不能为空：" + key };
    if (option.text.length > 1000) return { ok: false, error: "选项内容过长：" + key };
    optionKeys.add(key);
  }
  if (!Array.isArray(row.answer) || row.answer.length === 0) return { ok: false, error: "必须指定正确答案" };
  for (const answer of row.answer) {
    if (!optionKeys.has(answer)) return { ok: false, error: "正确答案 " + answer + " 不在选项里" };
  }
  if ((row.type === "single" || row.type === "judge") && row.answer.length !== 1) {
    return { ok: false, error: "单选/判断题只能有 1 个正确答案" };
  }
  if (row.type === "judge" && row.options.length !== 2) return { ok: false, error: "判断题必须正好 2 个选项" };
  if (row.status === "published" && !row.explanation.trim()) return { ok: false, error: "已发布题必须有解析" };
  if (row.explanation.length > 5000) return { ok: false, error: "解析超过 5000 字上限" };
  if (!Array.isArray(row.tags) || row.tags.length > 10) return { ok: false, error: "标签最多 10 个" };
  return { ok: true };
}

/** 题目 patch 白名单归一（返回可直接合并到现有行的字段）。 */
export function normalizeQuestionPatch(
  input: unknown
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "patch 必须是对象" };
  const raw = input as Record<string, unknown>;
  const allowed = ["stem", "options", "answer", "explanation", "tags", "difficulty", "level", "type", "status"];
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) return { ok: false, error: "不支持修改字段：" + key };
  }
  const patch: Record<string, unknown> = {};

  if ("stem" in raw) {
    const value = str(raw.stem, "题干", 2000);
    if (isError(value)) return { ok: false, error: value.error };
    patch.stem = value;
  }
  if ("explanation" in raw) {
    const value = typeof raw.explanation === "string" ? raw.explanation.trim() : null;
    if (value === null) return { ok: false, error: "解析必须是字符串" };
    if (value.length > 5000) return { ok: false, error: "解析超过 5000 字上限" };
    patch.explanation = value;
  }
  if ("options" in raw) {
    if (!Array.isArray(raw.options)) return { ok: false, error: "选项必须是数组" };
    patch.options = raw.options;
  }
  if ("answer" in raw) {
    const value = stringList(raw.answer, "答案", 8, 4);
    if (isError(value)) return { ok: false, error: value.error };
    patch.answer = value;
  }
  if ("tags" in raw) {
    const value = stringList(raw.tags, "标签", 10, 30);
    if (isError(value)) return { ok: false, error: value.error };
    patch.tags = value;
  }
  if ("difficulty" in raw) patch.difficulty = raw.difficulty;
  if ("level" in raw) patch.level = raw.level === null || raw.level === "" ? null : raw.level;
  if ("type" in raw) patch.type = raw.type;
  if ("status" in raw) patch.status = raw.status;
  return { ok: true, patch };
}

/** 读一行题目（含正文）。 */
export async function getQuestion(key: string): Promise<QuestionRowFull | null> {
  const { rows } = await pgPool.query<QuestionRowFull>(
    `SELECT key, track_slug, stage_key, topic_key, type, difficulty, level, status,
            stem, options, answer, explanation, tags, source_key, updated_at
       FROM learning_questions WHERE key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

/** 更新题目：按合并后的整行校验，写库后清缓存。 */
export async function updateQuestion(key: string, patch: Record<string, unknown>): Promise<PatchResult> {
  const current = await getQuestion(key);
  if (!current) return { ok: false, error: "题目不存在" };
  const merged = { ...current, ...patch };
  const valid = validateQuestion({
    type: merged.type,
    status: merged.status,
    stem: merged.stem,
    explanation: merged.explanation,
    options: merged.options,
    answer: merged.answer,
    difficulty: merged.difficulty,
    level: merged.level,
    tags: merged.tags,
  });
  if (!valid.ok) return valid;

  await pgPool.query(
    `UPDATE learning_questions
        SET stem = $2, options = $3::jsonb, answer = $4::jsonb, explanation = $5,
            tags = $6::jsonb, difficulty = $7, level = $8, type = $9, status = $10,
            fingerprint = '', manually_edited_at = now(), updated_at = now()
      WHERE key = $1`,
    [
      key, merged.stem, JSON.stringify(merged.options), JSON.stringify(merged.answer),
      merged.explanation, JSON.stringify(merged.tags ?? []), merged.difficulty,
      merged.level, merged.type, merged.status,
    ]
  );
  invalidateLearningTracksCache();
  return { ok: true };
}

export interface QuestionListFilter {
  q?: string; track?: string; status?: string; level?: string; limit?: number; offset?: number;
}

/** 后台题目列表（只回必要列，正文按需再取）。 */
export async function listQuestions(filter: QuestionListFilter) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.q) { params.push("%" + filter.q + "%"); where.push("stem ILIKE $" + params.length); }
  if (filter.track) { params.push(filter.track); where.push("track_slug = $" + params.length); }
  if (filter.status) { params.push(filter.status); where.push("status = $" + params.length); }
  if (filter.level) { params.push(filter.level); where.push("level = $" + params.length); }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const totalRes = await pgPool.query<{ n: number }>("SELECT count(*)::int AS n FROM learning_questions" + clause, params);
  const rowsRes = await pgPool.query<QuestionRowFull>(
    `SELECT key, track_slug, stage_key, topic_key, type, difficulty, level, status,
            stem, options, answer, explanation, tags, source_key, updated_at
       FROM learning_questions` + clause + ` ORDER BY track_slug, sort_order, key LIMIT ` + limit + " OFFSET " + offset,
    params
  );
  return { rows: rowsRes.rows, total: totalRes.rows[0]?.n ?? 0, limit, offset };
}

// ---------------- 知识点 ----------------

export interface TopicRowFull {
  track_slug: string; key: string; stage_key: string; title: string; summary: string;
  concepts: string[]; principles: string[]; applications: string[]; pitfalls: string[];
  method: string; exercise: string; checkpoint: string; lesson: unknown; status: string; updated_at: string;
}

export function normalizeTopicPatch(
  input: unknown
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "patch 必须是对象" };
  const raw = input as Record<string, unknown>;
  const textFields: [string, number][] = [["title", 200], ["summary", 1000], ["method", 2000], ["exercise", 2000], ["checkpoint", 1000]];
  const listFields: [string, number, number][] = [
    ["concepts", 20, 500], ["principles", 20, 500], ["applications", 20, 500], ["pitfalls", 20, 500],
  ];
  const allowed = [...textFields.map(([f]) => f), ...listFields.map(([f]) => f), "lesson", "status"];
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) return { ok: false, error: "不支持修改字段：" + key };
  }
  const patch: Record<string, unknown> = {};
  for (const [field, max] of textFields) {
    if (!(field in raw)) continue;
    const value = str(raw[field], field, max);
    if (isError(value)) return { ok: false, error: value.error };
    patch[field] = value;
  }
  for (const [field, maxItems, maxLen] of listFields) {
    if (!(field in raw)) continue;
    const value = stringList(raw[field], field, maxItems, maxLen);
    if (isError(value)) return { ok: false, error: value.error };
    patch[field] = value;
  }
  if ("lesson" in raw) {
    const lesson = raw.lesson;
    if (lesson !== null && (typeof lesson !== "object" || Array.isArray(lesson))) {
      return { ok: false, error: "lesson 必须是对象或 null" };
    }
    if (lesson !== null && JSON.stringify(lesson).length > 60000) return { ok: false, error: "lesson 过大（>60KB）" };
    patch.lesson = lesson === null ? null : lesson;
  }
  if ("status" in raw) {
    if (!STATUSES.includes(raw.status as (typeof STATUSES)[number])) return { ok: false, error: "状态不合法" };
    patch.status = raw.status;
  }
  return { ok: true, patch };
}

/** 更新知识点：title/summary 等必填字段按合并后校验。 */
export async function updateTopic(trackSlug: string, key: string, patch: Record<string, unknown>): Promise<PatchResult> {
  const { rows } = await pgPool.query<TopicRowFull>(
    `SELECT track_slug, key, stage_key, title, summary, concepts, principles, applications, pitfalls,
            method, exercise, checkpoint, lesson, status, updated_at
       FROM learning_topics WHERE track_slug = $1 AND key = $2`,
    [trackSlug, key]
  );
  const current = rows[0];
  if (!current) return { ok: false, error: "知识点不存在" };
  const merged = { ...current, ...patch };
  if (!String(merged.title ?? "").trim()) return { ok: false, error: "标题不能为空" };
  if (!String(merged.summary ?? "").trim()) return { ok: false, error: "摘要不能为空" };

  await pgPool.query(
    `UPDATE learning_topics
        SET title = $3, summary = $4, concepts = $5::jsonb, principles = $6::jsonb,
            applications = $7::jsonb, pitfalls = $8::jsonb, method = $9, exercise = $10,
            checkpoint = $11, lesson = $12::jsonb, status = $13, fingerprint = '',
            manually_edited_at = now(), updated_at = now()
      WHERE track_slug = $1 AND key = $2`,
    [
      trackSlug, key, merged.title, merged.summary, JSON.stringify(merged.concepts ?? []),
      JSON.stringify(merged.principles ?? []), JSON.stringify(merged.applications ?? []),
      JSON.stringify(merged.pitfalls ?? []), merged.method ?? "", merged.exercise ?? "",
      merged.checkpoint ?? "", merged.lesson ? JSON.stringify(merged.lesson) : null, merged.status,
    ]
  );
  invalidateLearningTracksCache();
  return { ok: true };
}

export interface TopicListFilter { q?: string; track?: string; limit?: number; offset?: number }

export async function listTopics(filter: TopicListFilter) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.q) {
    params.push("%" + filter.q + "%");
    where.push("(title ILIKE $" + params.length + " OR summary ILIKE $" + params.length + " OR key ILIKE $" + params.length + ")");
  }
  if (filter.track) { params.push(filter.track); where.push("track_slug = $" + params.length); }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  const totalRes = await pgPool.query<{ n: number }>("SELECT count(*)::int AS n FROM learning_topics" + clause, params);
  const rowsRes = await pgPool.query<TopicRowFull>(
    `SELECT track_slug, key, stage_key, title, summary, concepts, principles, applications, pitfalls,
            method, exercise, checkpoint, lesson, status, updated_at
       FROM learning_topics` + clause + " ORDER BY track_slug, sort_order LIMIT " + limit + " OFFSET " + offset,
    params
  );
  return { rows: rowsRes.rows, total: totalRes.rows[0]?.n ?? 0, limit, offset };
}
