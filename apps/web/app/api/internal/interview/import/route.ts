import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import {
  chunkItems,
  planImport,
  type ExistingQuestion,
  type InterviewImportItem,
} from "@/lib/interview/import-core";
import { markInterviewRun, type InterviewRunPatch } from "@/lib/tasks/interview";

export type { InterviewImportItem };

/** 单批写入上限；超过则自动分块（调用方不必自己切） */
const MAX_ITEMS_PER_CHUNK = 1000;
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const INSERT_SQL =
  "INSERT INTO interview_questions (module, question, answer, difficulty, tags, source_url, source_site, license, external_key, crawled_at, is_listed) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,true) ON CONFLICT (external_key) WHERE external_key IS NOT NULL DO UPDATE SET module = EXCLUDED.module, answer = EXCLUDED.answer, difficulty = EXCLUDED.difficulty, tags = EXCLUDED.tags, source_url = EXCLUDED.source_url, source_site = EXCLUDED.source_site, license = EXCLUDED.license, crawled_at = EXCLUDED.crawled_at, is_listed = true, updated_at = now()";

/** 库里已有同一道题（历史遗留的旧去重键）→ 更新这一行而不是插新行，从根上避免重复 */
const UPDATE_SQL =
  "UPDATE interview_questions SET module = $2, answer = $3, difficulty = $4, tags = $5::jsonb, source_url = $6, source_site = $7, license = $8, crawled_at = $9, is_listed = true, updated_at = now() WHERE id = $1";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

interface CleanItem {
  module: string;
  question: string;
  answer: string | null;
  difficulty: string;
  tags: string[];
  sourceUrl: string | null;
  sourceSite: string | null;
  license: string | null;
  crawledAt: string | null;
}

/** 字段截断与枚举兜底（与旧实现同口径，保证既有调用方行为不变） */
function cleanItem(raw: InterviewImportItem): CleanItem | null {
  const moduleName = text(raw?.module, 40);
  const question = text(raw?.question, 400);
  if (!moduleName || question.length < 6) return null;
  const rawDifficulty = text(raw?.difficulty, 10).toLowerCase();
  return {
    module: moduleName,
    question,
    answer: text(raw?.answer, 8000) || null,
    difficulty: DIFFICULTIES.has(rawDifficulty) ? rawDifficulty : "medium",
    tags: Array.isArray(raw?.tags) ? raw.tags.map((t) => text(t, 24)).filter(Boolean).slice(0, 8) : [],
    sourceUrl: text(raw?.sourceUrl, 500) || null,
    sourceSite: text(raw?.sourceSite, 120) || null,
    license: text(raw?.license, 60) || null,
    crawledAt: raw?.crawledAt ? new Date(raw.crawledAt).toISOString() : null,
  };
}

/** 可选的运行记录回报（脚本抓完/失败后回写 interview_crawl_runs 的终态） */
function parseRun(raw: unknown): (InterviewRunPatch & { runId: number }) | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const runId = Number(obj.runId);
  if (!Number.isInteger(runId) || runId <= 0) return null;
  const status = String(obj.status ?? "");
  const allowed = ["running", "success", "partial", "failed"] as const;
  const picked = (allowed as readonly string[]).includes(status)
    ? (status as InterviewRunPatch["status"])
    : "failed";
  return {
    runId,
    status: picked,
    fetched: Number.isFinite(Number(obj.fetched)) ? Number(obj.fetched) : undefined,
    imported: Number.isFinite(Number(obj.imported)) ? Number(obj.imported) : undefined,
    skipped: Number.isFinite(Number(obj.skipped)) ? Number(obj.skipped) : undefined,
    error: typeof obj.error === "string" ? obj.error.slice(0, 500) : null,
  };
}

/**
 * POST /api/internal/interview/import —— 批量导入面试题库（v12 P2-1，v1.26 增强）
 *
 * 鉴权：x-cron-secret == CRON_SECRET（与 cron / 装备导入同款）。
 * 合规：只接受公开来源的数据，sourceUrl / sourceSite / license 一律落库；可用 is_listed 一键下架。
 *
 * v1.26 变化（都是为了"每天定时爬且不重复"）：
 *   - external_key 缺省时由**服务端**用归一化题目现算（脚本不再自负此责）；
 *   - 判重按「题目归一化」比对库里已有行：历史 611 条是按原始文本算键的，
 *     只认 external_key 会在重爬时插出第二份，现在命中同一道题就更新那一行；
 *   - 支持一次提交超过 1000 条（自动分块）；
 *   - 允许 items 为空，只要带 run 回报（抓取失败时也能把运行记录写成 failed）。
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { items?: unknown; run?: unknown } | null;
  const rawItems = Array.isArray(body?.items) ? (body.items as InterviewImportItem[]) : [];
  const run = parseRun(body?.run);

  if (rawItems.length === 0 && !run) {
    return NextResponse.json({ error: "items 不能为空" }, { status: 400 });
  }

  // 已有题目一次拉全（只取判重需要的三列：线上约 611 行，量级完全可接受）
  const { rows: existingRows } = await pgPool.query<ExistingQuestion>(
    "SELECT id, external_key AS \"externalKey\", question FROM interview_questions WHERE is_listed = true"
  );
  const existing: ExistingQuestion[] = [...existingRows];

  let imported = 0;
  let duplicateInPayload = 0;
  const skipped: string[] = [];

  /**
   * 顺序很重要：**先做字段校验，再判重**。
   * 反过来（先判重后校验）时，两条"同样非法"的条目会被当成 payload 内重复而合并，
   * skipped 计数就少于调用方看到的条数，排障时容易误判。
   */
  const cleanByRaw = new Map<InterviewImportItem, CleanItem>();
  for (const raw of rawItems) {
    const clean = cleanItem(raw);
    if (!clean) {
      skipped.push(text(raw?.question, 40));
      continue;
    }
    cleanByRaw.set(raw, clean);
  }

  for (const batch of chunkItems([...cleanByRaw.keys()], MAX_ITEMS_PER_CHUNK)) {
    const plan = planImport(batch, existing);
    duplicateInPayload += plan.duplicateInPayload;

    for (const entry of plan.entries) {
      const clean = cleanByRaw.get(entry.item);
      if (!clean) continue;
      const params = [
        clean.module,
        clean.question,
        clean.answer,
        clean.difficulty,
        JSON.stringify(clean.tags),
        clean.sourceUrl,
        clean.sourceSite,
        clean.license,
        entry.key,
        clean.crawledAt,
      ];
      if (entry.action === "update" && entry.targetId) {
        await pgPool.query(UPDATE_SQL, [entry.targetId, ...params.slice(0, 8)]);
      } else {
        const { rows } = await pgPool.query<{ id: number }>(INSERT_SQL + " RETURNING id", params);
        // 让后续分块也能看到刚插入的这一条（同一次请求内的二次判重）
        existing.push({ id: Number(rows[0]?.id ?? 0), externalKey: entry.key, question: clean.question });
      }
      imported += 1;
    }
  }

  if (run) {
    await markInterviewRun(run.runId, {
      status: run.status,
      fetched: run.fetched,
      imported: run.imported ?? imported,
      skipped: run.skipped ?? skipped.length,
      error: run.error ?? null,
    });
  }

  return NextResponse.json({ imported, skipped, duplicateInPayload, runId: run?.runId ?? null });
}
