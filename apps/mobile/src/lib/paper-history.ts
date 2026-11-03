import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import type { PaperStat } from "@/lib/paper-result";

/**
 * 408 套卷历史成绩（P3-2B）。
 *
 * 数据来源：
 * - 服务端：POST /api/exam/408/paper-attempts（Bearer 鉴权），GET 同路径按 limit 拉取；
 * - 本机：AsyncStorage `lwb.paper.history.v1`，最多 20 条、按 submittedAt 降序。
 *
 * 上报策略（「成功失败都写本地缓存」，见 task-5）：
 * - 未登录 / 401 / 离线 / 5xx / 响应异常 → 失败不抛，降级为本机缓存；
 * - 成功 → 用服务端返回的 attempt 补齐 id 后再写缓存，历史页优先读服务端。
 */

/** 本机历史缓存键（最多 20 条） */
export const PAPER_HISTORY_KEY = "lwb.paper.history.v1";
/** 本地 / 服务端历史条数上限（与 form 约定一致） */
export const PAPER_HISTORY_LIMIT = 20;
const PAPER_ATTEMPTS_PATH = "/api/exam/408/paper-attempts";

/** 提交失败分类：401 引导登录，离线/服务端异常下次再拉服务端或读本机缓存 */
export type PaperAttemptFailure = "unauthorized" | "offline" | "server";

/** 上报载荷：与 web-paper 的服务端契约逐字段对齐（camelCase） */
export interface PaperAttemptPayload {
  year: number;
  score: number;
  totalScore: number;
  correct: number;
  wrong: number;
  unanswered: number;
  durationSeconds: number;
  startedAt: string;
  submittedAt: string;
  byPoint: PaperStat[];
  bySubject: PaperStat[];
}

/** 历史记录 = 上报载荷 + 记录 id（服务端 id 或本地 id） */
export interface PaperAttemptRecord extends PaperAttemptPayload {
  id: string;
  createdAt?: string;
}

export interface PaperSubmitOutcome {
  ok: boolean;
  failure: PaperAttemptFailure | null;
  record: PaperAttemptRecord | null;
}

export interface PaperHistoryFetch {
  attempts: PaperAttemptRecord[];
  total: number;
  failure: PaperAttemptFailure | null;
}

/* ------------------------------------------------------------------ */
/* 归一化 / 清洗                                                         */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** ISO 时间字符串校验：解析失败返回 null（脏数据直接丢弃该字段/整条记录） */
function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return Number.isFinite(Date.parse(text)) ? text : null;
}

/** 非负有限数：数字字符串也接受，其余（NaN / 负数 / 布尔）回落 fallback */
function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const raw = typeof value === "string" ? Number(value) : value;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return fallback;
  return raw;
}

/** 计数类字段统一取整 */
function toCount(value: unknown): number {
  return Math.round(toNonNegativeNumber(value));
}

function normalizeStat(value: unknown): PaperStat | null {
  if (!isRecord(value)) return null;
  const key = typeof value.key === "string" ? value.key.trim() : "";
  if (!key) return null;
  const wrong = toCount(value.wrong);
  const total = toCount(value.total);
  const title = typeof value.title === "string" ? value.title.trim() : "";
  return { key, title: title || key, wrong, total };
}

/** 统计数组清洗：丢弃非法行，同 key 只保留第一条 */
function normalizeStats(value: unknown): PaperStat[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: PaperStat[] = [];
  for (const item of value) {
    const stat = normalizeStat(item);
    if (!stat || seen.has(stat.key)) continue;
    seen.add(stat.key);
    rows.push(stat);
  }
  return rows;
}

function makeLocalAttemptId(submittedAt: string): string {
  const base = Number.isFinite(Date.parse(submittedAt)) ? Date.parse(submittedAt) : Date.now();
  const suffix = Math.random().toString(36).slice(2, 10);
  return `local-${base}-${suffix}`;
}

/**
 * 把任意来源（服务端返回 / AsyncStorage 脏数据）归一成历史记录。
 * 必要条件：year（2000-2100）与可解析的 submittedAt（缺省时用 createdAt 兜底）。
 */
export function normalizePaperAttempt(value: unknown): PaperAttemptRecord | null {
  if (!isRecord(value)) return null;
  const year = toCount(value.year);
  if (year < 2000 || year > 2100) return null;
  const submittedAt = normalizeIso(value.submittedAt) ?? normalizeIso(value.createdAt);
  if (!submittedAt) return null;
  const startedAt = normalizeIso(value.startedAt) ?? submittedAt;
  const createdAt = normalizeIso(value.createdAt);
  const rawId =
    typeof value.id === "string" ? value.id.trim() : typeof value.id === "number" ? String(value.id) : "";
  return {
    id: rawId || makeLocalAttemptId(submittedAt),
    year,
    score: toNonNegativeNumber(value.score),
    totalScore: toNonNegativeNumber(value.totalScore),
    correct: toCount(value.correct),
    wrong: toCount(value.wrong),
    unanswered: toCount(value.unanswered),
    durationSeconds: toCount(value.durationSeconds),
    startedAt,
    submittedAt,
    byPoint: normalizeStats(value.byPoint),
    bySubject: normalizeStats(value.bySubject),
    ...(createdAt ? { createdAt } : {}),
  };
}

/** 去重（同 id 后写覆盖）→ 按交卷时间降序 → 最多 20 条；时间相同时按 id 升序保证稳定 */
export function sortPaperAttempts(attempts: readonly PaperAttemptRecord[]): PaperAttemptRecord[] {
  const byId = new Map<string, PaperAttemptRecord>();
  for (const attempt of attempts) {
    const previous = byId.get(attempt.id);
    byId.set(attempt.id, previous ? { ...previous, ...attempt } : attempt);
  }
  return [...byId.values()]
    .sort((left, right) => {
      const delta = Date.parse(right.submittedAt) - Date.parse(left.submittedAt);
      if (delta !== 0) return delta;
      if (left.id === right.id) return 0;
      return left.id < right.id ? -1 : 1;
    })
    .slice(0, PAPER_HISTORY_LIMIT);
}

/* ------------------------------------------------------------------ */
/* 本机缓存                                                              */
/* ------------------------------------------------------------------ */

function buildLocalAttempt(payload: PaperAttemptPayload): PaperAttemptRecord {
  const submittedAt = normalizeIso(payload.submittedAt) ?? new Date().toISOString();
  return {
    id: makeLocalAttemptId(submittedAt),
    year: toCount(payload.year),
    score: toNonNegativeNumber(payload.score),
    totalScore: toNonNegativeNumber(payload.totalScore),
    correct: toCount(payload.correct),
    wrong: toCount(payload.wrong),
    unanswered: toCount(payload.unanswered),
    durationSeconds: toCount(payload.durationSeconds),
    startedAt: normalizeIso(payload.startedAt) ?? submittedAt,
    submittedAt,
    byPoint: normalizeStats(payload.byPoint),
    bySubject: normalizeStats(payload.bySubject),
  };
}

async function savePaperHistory(attempts: readonly PaperAttemptRecord[]): Promise<void> {
  try {
    const clean = sortPaperAttempts(attempts);
    if (clean.length === 0) await AsyncStorage.removeItem(PAPER_HISTORY_KEY);
    else await AsyncStorage.setItem(PAPER_HISTORY_KEY, JSON.stringify(clean));
  } catch {
    // 缓存写失败不阻塞交卷
  }
}

/** 读本机历史（脏数据清洗 + 倒序 + 最多 20 条）；离线时历史页据此展示 */
export async function loadPaperHistory(): Promise<PaperAttemptRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(PAPER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const records = parsed
      .map(normalizePaperAttempt)
      .filter((item): item is PaperAttemptRecord => item !== null);
    return sortPaperAttempts(records);
  } catch {
    return [];
  }
}

async function recordPaperAttemptLocally(payload: PaperAttemptPayload): Promise<PaperAttemptRecord> {
  const record = buildLocalAttempt(payload);
  const current = await loadPaperHistory();
  await savePaperHistory([record, ...current]);
  return record;
}

/* ------------------------------------------------------------------ */
/* 网络                                                                  */
/* ------------------------------------------------------------------ */

function paperAttemptsUrl(): string {
  return getApiUrl().replace(/\/+$/, "") + PAPER_ATTEMPTS_PATH;
}

function readAttemptPayload(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  if (isRecord(body.attempt)) return body.attempt;
  return body;
}

/**
 * 交卷成绩上报。
 *
 * 无论成功、401、离线还是服务端异常都会写本机缓存（失败不抛）：
 * 401 时仅本地保存，页面提示登录后可在本机历史查看。
 */
export async function submitPaperAttempt(payload: PaperAttemptPayload): Promise<PaperSubmitOutcome> {
  const token = useAppStore.getState().token;
  if (!token) {
    return { ok: false, failure: "unauthorized", record: await recordPaperAttemptLocally(payload) };
  }

  let response: Response;
  try {
    response = await fetch(paperAttemptsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, failure: "offline", record: await recordPaperAttemptLocally(payload) };
  }

  if (response.status === 401) {
    return { ok: false, failure: "unauthorized", record: await recordPaperAttemptLocally(payload) };
  }
  if (!response.ok) {
    return { ok: false, failure: "server", record: await recordPaperAttemptLocally(payload) };
  }

  const body = (await response.json().catch(() => null)) as unknown;
  const remote = readAttemptPayload(body);
  const record =
    (remote
      ? normalizePaperAttempt({
          ...payload,
          ...remote,
          id: remote.id,
          submittedAt: normalizeIso(remote.submittedAt) ?? payload.submittedAt,
          startedAt: normalizeIso(remote.startedAt) ?? payload.startedAt,
        })
      : null) ?? buildLocalAttempt(payload);
  await savePaperHistory([record, ...(await loadPaperHistory())]);
  return { ok: true, failure: null, record };
}

/**
 * 拉取服务端历史成绩（登录用户）。
 *
 * 未登录 / 离线 / 服务端异常都返回结构化 failure（不抛），页面据此回退本机缓存；
 * 成功时顺带刷新本机缓存，供下次离线查看。
 */
export async function fetchPaperAttempts(limit = PAPER_HISTORY_LIMIT): Promise<PaperHistoryFetch> {
  const token = useAppStore.getState().token;
  if (!token) return { attempts: [], total: 0, failure: "unauthorized" };

  const safeLimit = Math.max(1, Math.min(PAPER_HISTORY_LIMIT, Math.round(limit) || PAPER_HISTORY_LIMIT));
  let response: Response;
  try {
    response = await fetch(`${paperAttemptsUrl()}?limit=${safeLimit}`, {
      headers: { Authorization: "Bearer " + token },
    });
  } catch {
    return { attempts: [], total: 0, failure: "offline" };
  }

  if (response.status === 401) return { attempts: [], total: 0, failure: "unauthorized" };
  if (!response.ok) return { attempts: [], total: 0, failure: "server" };

  const body = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(body) || !Array.isArray(body.attempts)) {
    return { attempts: [], total: 0, failure: "server" };
  }
  const records = body.attempts
    .map(normalizePaperAttempt)
    .filter((item): item is PaperAttemptRecord => item !== null);
  const attempts = sortPaperAttempts(records);
  const total = toCount(body.total) || attempts.length;
  await savePaperHistory(attempts);
  return { attempts, total, failure: null };
}

/* ------------------------------------------------------------------ */
/* 展示格式化                                                            */
/* ------------------------------------------------------------------ */

/** 用时：秒 → 「X 小时 Y 分 / X 分 Y 秒 / Y 秒」 */
export function formatPaperDuration(seconds: unknown): string {
  const total = Math.round(toNonNegativeNumber(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  if (minutes > 0) return `${minutes} 分 ${secs} 秒`;
  return `${secs} 秒`;
}

/** 正确率（0-100）：只按已判对错的选择题计算，没有已判题时为 0 */
export function paperAccuracy(correct: number, wrong: number): number {
  const judged = toCount(correct) + toCount(wrong);
  if (judged <= 0) return 0;
  return Math.round((toCount(correct) / judged) * 100);
}

/** 交卷时间：ISO → 本机时区的 YYYY-MM-DD HH:mm；无法解析返回空串 */
export function formatPaperAttemptTime(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
