import { pgPool } from "@/lib/db";

/**
 * 408 套卷历史成绩读写层（P3-2A）。
 *
 * 分工：
 *   - 表 exam_408_paper_attempts（迁移 092）是**追加型**历史：一次交卷一条记录，
 *     不做软删与原地更新；user_id 是唯一隔离维度；
 *   - 本文件的纯函数负责**入参校验与归一化**（结构非法 → 400；条目脏项丢弃），
 *     SQL 读写只接收归一化后的值，读取时也过同一套归一化（历史 jsonb 脏数据不会漏给客户端）；
 *   - 路由只做鉴权（currentUserId）与 HTTP 状态码映射。
 *
 * 契约（App 端按此实现）：
 *   POST /api/exam/408/paper-attempts
 *     body { year, score, totalScore, correct, wrong, unanswered,
 *            durationSeconds: number|null, startedAt: string|null, submittedAt: string,
 *            byPoint: [{ key, title, wrong, total }], bySubject: [...] }
 *     -> 201 { attempt: { id: string, ... } }
 *   GET /api/exam/408/paper-attempts?limit=20 -> { attempts: [...], total: number }
 */

/** 列表默认条数（契约默认 20） */
export const PAPER_ATTEMPT_DEFAULT_LIMIT = 20;
/** 列表最多条数（契约上限 50） */
export const PAPER_ATTEMPT_MAX_LIMIT = 50;
export const PAPER_ATTEMPT_MIN_LIMIT = 1;

/** 试卷年份与 exam_408_papers.year 同口径 */
export const PAPER_ATTEMPT_YEAR_MIN = 2000;
export const PAPER_ATTEMPT_YEAR_MAX = 2100;

/**
 * 计数类字段的硬上限：
 * PostgreSQL int4 上限。超出这个值的"分数/题数"不是合法业务数据，
 * 纯函数直接判 400，避免让数据库抛 22003 再被兜底成 500。
 */
const INT4_MAX = 2_147_483_647;

/** 按知识点 / 科目的错题条目（字段与契约一一对应） */
export interface PaperAttemptBreakdownItem {
  key: string;
  title: string;
  /** 该维度答错题数 */
  wrong: number;
  /** 该维度题量（wrong <= total 由上游保证，这里不额外收窄） */
  total: number;
}

/** 一次交卷的完整成绩（归一化后；createPaperAttempt 的入参） */
export interface PaperAttemptInput {
  year: number;
  score: number;
  totalScore: number;
  correct: number;
  wrong: number;
  unanswered: number;
  durationSeconds: number | null;
  startedAt: string | null;
  submittedAt: string;
  byPoint: PaperAttemptBreakdownItem[];
  bySubject: PaperAttemptBreakdownItem[];
}

/** 落库后返回给客户端的成绩（id 一律 string，bigint 不交给 JS number） */
export interface PaperAttempt extends PaperAttemptInput {
  id: string;
}

/** 校验结果：失败时给出可直接进 400 响应体的中文原因 */
export type PaperAttemptInputResult =
  | { ok: true; value: PaperAttemptInput }
  | { ok: false; error: string };

/* ============================ 纯函数：校验 / 归一化 ============================ */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 计数类字段：必须是 int4 范围内的非负整数（不接收数字字符串，契约是 number） */
function readCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0 || value > INT4_MAX) return null;
  return value;
}

/** 时间戳字段：合法 ISO/日期串 → 统一成 UTC ISO；null/undefined 保留 null；非法 → undefined */
function readTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

/**
 * 错题条目归一化：**条目级**脏数据丢弃（缺 key/title、wrong/total 非非负整数等），
 * 不做整体报错 —— 一个知识点 key 脏了不该让整张卷子的成绩丢失。
 */
export function normalizePaperAttemptBreakdown(value: unknown): PaperAttemptBreakdownItem[] {
  if (!Array.isArray(value)) return [];
  const items: PaperAttemptBreakdownItem[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) continue;
    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const wrong = readCount(raw.wrong);
    const total = readCount(raw.total);
    if (key.length === 0 || title.length === 0 || wrong === null || total === null) continue;
    items.push({ key, title, wrong, total });
  }
  return items;
}

/**
 * 校验并归一化 POST body（纯函数，不碰数据库）。
 *
 * 契约：结构非法**整体 400**（body 不是对象、缺年份/提交时间、计数不是非负整数、
 * byPoint/bySubject 不是数组等）；条目内部的脏项单独丢弃（见 normalizePaperAttemptBreakdown）。
 */
export function normalizePaperAttemptInput(raw: unknown): PaperAttemptInputResult {
  if (!isPlainObject(raw)) return { ok: false, error: "成绩数据格式不正确" };

  const year = readCount(raw.year);
  if (year === null || year < PAPER_ATTEMPT_YEAR_MIN || year > PAPER_ATTEMPT_YEAR_MAX) {
    return { ok: false, error: "year 必须是 2000 至 2100 之间的整数" };
  }

  const score = readCount(raw.score);
  if (score === null) return { ok: false, error: "score 必须是非负整数" };
  const totalScore = readCount(raw.totalScore);
  if (totalScore === null) return { ok: false, error: "totalScore 必须是非负整数" };
  const correct = readCount(raw.correct);
  if (correct === null) return { ok: false, error: "correct 必须是非负整数" };
  const wrong = readCount(raw.wrong);
  if (wrong === null) return { ok: false, error: "wrong 必须是非负整数" };
  const unanswered = readCount(raw.unanswered);
  if (unanswered === null) return { ok: false, error: "unanswered 必须是非负整数" };

  // durationSeconds 可空：缺失等同 null，但给了就必须是非负整数
  const durationSeconds = raw.durationSeconds === undefined ? null : readCount(raw.durationSeconds);
  if (durationSeconds === null && raw.durationSeconds !== undefined && raw.durationSeconds !== null) {
    return { ok: false, error: "durationSeconds 必须是非负整数或 null" };
  }

  const startedAt = readTimestamp(raw.startedAt);
  if (startedAt === undefined) return { ok: false, error: "startedAt 必须是合法时间或 null" };

  // submittedAt 必填：历史页的排序键，缺失会让记录无法定位
  const submittedAt = readTimestamp(raw.submittedAt);
  if (submittedAt === undefined || submittedAt === null) {
    return { ok: false, error: "submittedAt 必须是合法时间" };
  }

  if (!Array.isArray(raw.byPoint)) return { ok: false, error: "byPoint 必须是数组" };
  if (!Array.isArray(raw.bySubject)) return { ok: false, error: "bySubject 必须是数组" };

  return {
    ok: true,
    value: {
      year,
      score,
      totalScore,
      correct,
      wrong,
      unanswered,
      durationSeconds,
      startedAt,
      submittedAt,
      byPoint: normalizePaperAttemptBreakdown(raw.byPoint),
      bySubject: normalizePaperAttemptBreakdown(raw.bySubject),
    },
  };
}

/** limit 归一化：非法/缺省 → 20；小于 1 → 1；大于 50 → 50（契约 clamp 1..50） */
export function clampPaperAttemptLimit(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return PAPER_ATTEMPT_DEFAULT_LIMIT;
  const floored = Math.floor(value);
  if (floored < PAPER_ATTEMPT_MIN_LIMIT) return PAPER_ATTEMPT_MIN_LIMIT;
  return Math.min(PAPER_ATTEMPT_MAX_LIMIT, floored);
}

/* ============================ SQL：行映射与读写 ============================ */

/** 返回列（snake_case → mapPaperAttemptRow 统一转 camelCase；id 转 string） */
const PAPER_ATTEMPT_COLUMNS = `
  id, paper_year, score, total_score, correct, wrong, unanswered,
  duration_seconds, started_at, submitted_at, by_point, by_subject`;

interface PaperAttemptRow {
  id: string | number;
  paper_year: number | string;
  score: number | string;
  total_score: number | string;
  correct: number | string;
  wrong: number | string;
  unanswered: number | string;
  duration_seconds: number | string | null;
  started_at: Date | string | null;
  submitted_at: Date | string | null;
  by_point: unknown;
  by_subject: unknown;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toInt(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/** 行 → 客户端结构：id 一律 string；jsonb 列可能是对象/字符串/脏数据，统一走同款归一化 */
export function mapPaperAttemptRow(row: PaperAttemptRow): PaperAttempt {
  return {
    id: String(row.id),
    year: toInt(row.paper_year),
    score: toInt(row.score),
    totalScore: toInt(row.total_score),
    correct: toInt(row.correct),
    wrong: toInt(row.wrong),
    unanswered: toInt(row.unanswered),
    durationSeconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : toInt(row.duration_seconds),
    startedAt: toIsoOrNull(row.started_at),
    submittedAt: toIsoOrNull(row.submitted_at) ?? "",
    byPoint: normalizePaperAttemptBreakdown(row.by_point),
    bySubject: normalizePaperAttemptBreakdown(row.by_subject),
  };
}

/**
 * 写一条套卷成绩（调用方必须已登录并传入 currentUserId()）。
 *
 * 为什么 submittedAt 由客户端给：交卷时间可能早于请求到达时间（离线补传），
 * 历史页按真实交卷时间排序才符合用户预期；服务端仍保留 created_at 记录入库时间。
 */
export async function createPaperAttempt(userId: string, input: PaperAttemptInput): Promise<PaperAttempt> {
  const { rows } = await pgPool.query<PaperAttemptRow>(
    `INSERT INTO exam_408_paper_attempts
       (user_id, paper_year, score, total_score, correct, wrong, unanswered,
        duration_seconds, started_at, submitted_at, by_point, by_subject)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
     RETURNING ${PAPER_ATTEMPT_COLUMNS}`,
    [
      userId,
      input.year,
      input.score,
      input.totalScore,
      input.correct,
      input.wrong,
      input.unanswered,
      input.durationSeconds,
      input.startedAt,
      input.submittedAt,
      JSON.stringify(input.byPoint),
      JSON.stringify(input.bySubject),
    ]
  );
  return mapPaperAttemptRow(rows[0]);
}

/**
 * 读当前用户的历史成绩（新 → 旧），并返回总条数。
 *
 * total 是**该用户全量**条数（不是本次 limit 后条数），供 App 分页/展示"共 N 次"；
 * 所有查询都带 user_id（数据隔离红线）。
 */
export async function listPaperAttempts(
  userId: string,
  options: { limit?: number } = {}
): Promise<{ attempts: PaperAttempt[]; total: number }> {
  const limit = clampPaperAttemptLimit(options.limit);
  const [totalResult, rowsResult] = await Promise.all([
    pgPool.query<{ total: number | string }>(
      "SELECT count(*)::int AS total FROM exam_408_paper_attempts WHERE user_id = $1",
      [userId]
    ),
    pgPool.query<PaperAttemptRow>(
      `SELECT ${PAPER_ATTEMPT_COLUMNS}
         FROM exam_408_paper_attempts
        WHERE user_id = $1
        ORDER BY submitted_at DESC, id DESC
        LIMIT $2`,
      [userId, limit]
    ),
  ]);
  return {
    attempts: rowsResult.rows.map(mapPaperAttemptRow),
    total: toInt(totalResult.rows[0]?.total),
  };
}
