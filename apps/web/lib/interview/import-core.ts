/**
 * 面试题库导入的**纯逻辑核心**（v1.26）—— 零 DB / 零网络 / 零 react-native 依赖，
 * 因此可以被 vitest 直接加载（踩坑 48/89）。
 *
 * 三件事在这里定死，脚本与服务端都以此为准：
 *   1. 归一化口径 normalizeQuestion()（去重键的基础）
 *   2. 去重键 externalKeyFor()（与 054 迁移的 external_key 列同形：<sourceSite>#<sha1 前 16 位>）
 *   3. 把「本轮抓取的条目 × 库里已有行」编排成可执行的导入计划 planImport()
 *
 * ⚠️ 归一化口径**必须**与 db 侧无关地稳定：这里只做「全角空格→半角 + 小写 + 去所有空白」，
 * 不做标点/同义改写 —— 否则同一道题在两次运行间会算出不同的键，反而制造重复。
 */
import { createHash } from "node:crypto";

export interface InterviewImportItem {
  module: string;
  question: string;
  answer?: string | null;
  difficulty?: string | null;
  tags?: string[] | null;
  sourceUrl?: string | null;
  sourceSite?: string | null;
  license?: string | null;
  /** 去重键；缺省时由服务端用 externalKeyFor() 现算（脚本不再自负此责） */
  externalKey?: string | null;
  crawledAt?: string | null;
}

/** 库里已有行（只取判重需要的字段，避免把大字段拉回来） */
export interface ExistingQuestion {
  id: number;
  externalKey: string | null;
  question: string;
}

/**
 * 题目归一化：全角空格 → 半角、转小写、去掉所有空白。
 * 例：「什么是 JVM ？ 」与「什么是　JVM？」→ 同一个键。
 */
export function normalizeQuestion(question: string): string {
  return String(question ?? "")
    .replace(/\u3000/g, " ")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** 去重键：<sourceSite>#<sha1(normalized) 前 16 位>；sourceSite 缺失时用 "unknown" 兜底 */
export function externalKeyFor(sourceSite: string | null | undefined, question: string): string {
  const site = (sourceSite ?? "").trim() || "unknown";
  const digest = createHash("sha1").update(normalizeQuestion(question)).digest("hex").slice(0, 16);
  return site + "#" + digest;
}

/** 分块（服务端据此支持"一次 POST 超过单批上限"的调用方） */
export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n) as T[]);
  return out;
}

/**
 * 幂等判断：当天是否已有一次成功的面试爬取。
 * 与岗位爬虫的守卫同义（lib/tasks/crawler.ts），只是读另一张表；
 * 传进来的是「今天 + success」的行，纯函数便于单测。
 */
export function shouldRunInterviewCrawl(todaySuccessRuns: readonly { id: number }[]): boolean {
  return todaySuccessRuns.length === 0;
}

export type ImportAction = "insert" | "update";

export interface ImportPlanEntry {
  item: InterviewImportItem;
  /** insert = 新题；update = 库里已有同一道题（可能是历史遗留的旧键），改这一行而不是插新行 */
  action: ImportAction;
  targetId?: number;
  key: string;
}

export interface ImportPlan {
  entries: ImportPlanEntry[];
  /** 本次 payload 内部重复（同一道题出现多次）而被丢弃的条数 */
  duplicateInPayload: number;
}

/**
 * 编排导入计划（去重的最终口径）：
 *   1. 同一份 payload 内归一化后重复的题 → 只保留第一条（duplicateInPayload++）
 *   2. 库里已有**同一道题**（按归一化比对，与键无关）→ 更新那一行（targetId=已有 id）
 *      · 这条同时兜住了历史遗留：线上 611 条是按「原始文本」算键的，
 *        若只认 external_key，重爬会插出第二份；按题目归一化比对就不会。
 *   3. 其余 → 按 externalKey upsert 插入（DB 侧 ON CONFLICT (external_key) 兜底）
 */
export function planImport(items: readonly InterviewImportItem[], existing: readonly ExistingQuestion[]): ImportPlan {
  const byQuestion = new Map<string, ExistingQuestion>();
  for (const row of existing) {
    const key = normalizeQuestion(row.question);
    if (key && !byQuestion.has(key)) byQuestion.set(key, row);
  }

  const seen = new Set<string>();
  const entries: ImportPlanEntry[] = [];
  let duplicateInPayload = 0;

  for (const item of items) {
    const question = String(item?.question ?? "").trim();
    if (!question) continue;
    const norm = normalizeQuestion(question);
    if (!norm) continue;
    if (seen.has(norm)) {
      duplicateInPayload += 1;
      continue;
    }
    seen.add(norm);

    const key = (item.externalKey ?? "").trim() || externalKeyFor(item.sourceSite ?? null, question);
    const hit = byQuestion.get(norm);
    if (hit) entries.push({ item, action: "update", targetId: hit.id, key });
    else entries.push({ item, action: "insert", key });
  }

  return { entries, duplicateInPayload };
}
