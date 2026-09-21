import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

const MAX_ITEMS = 1000;

export interface InterviewImportItem {
  module: string;
  question: string;
  answer?: string | null;
  difficulty?: string | null;
  tags?: string[] | null;
  sourceUrl?: string | null;
  sourceSite?: string | null;
  license?: string | null;
  /** 去重键：sourceSite + "#" + sha1(question)，脚本侧算好传进来 */
  externalKey?: string | null;
  crawledAt?: string | null;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const UPSERT_SQL = "INSERT INTO interview_questions (module, question, answer, difficulty, tags, source_url, source_site, license, external_key, crawled_at, is_listed) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,true) ON CONFLICT (external_key) WHERE external_key IS NOT NULL DO UPDATE SET module = EXCLUDED.module, answer = EXCLUDED.answer, difficulty = EXCLUDED.difficulty, tags = EXCLUDED.tags, source_url = EXCLUDED.source_url, source_site = EXCLUDED.source_site, license = EXCLUDED.license, crawled_at = EXCLUDED.crawled_at, is_listed = true, updated_at = now()";

/**
 * POST /api/internal/interview/import —— 批量导入面试题库（v12 P2-1）
 * 鉴权：x-cron-secret == CRON_SECRET（与 cron / 装备导入同款）。
 * 合规：只接受公开来源的数据，sourceUrl / sourceSite / license 一律落库；可用 is_listed 一键下架。
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  const items = Array.isArray(body?.items) ? (body.items as InterviewImportItem[]) : [];
  if (items.length === 0) return NextResponse.json({ error: "items 不能为空" }, { status: 400 });
  if (items.length > MAX_ITEMS) return NextResponse.json({ error: "单次最多 " + MAX_ITEMS + " 条" }, { status: 400 });

  let imported = 0;
  const skipped: string[] = [];
  for (const raw of items) {
    const module = text(raw?.module, 40);
    const question = text(raw?.question, 400);
    const externalKey = text(raw?.externalKey, 200);
    if (!module || question.length < 6 || !externalKey) {
      skipped.push(question.slice(0, 40));
      continue;
    }
    const answer = text(raw?.answer, 8000) || null;
    const rawDifficulty = text(raw?.difficulty, 10).toLowerCase();
    const difficulty = DIFFICULTIES.has(rawDifficulty) ? rawDifficulty : "medium";
    const tags = Array.isArray(raw?.tags) ? raw.tags.map((t) => text(t, 24)).filter(Boolean).slice(0, 8) : [];

    await pgPool.query(UPSERT_SQL, [
      module,
      question,
      answer,
      difficulty,
      JSON.stringify(tags),
      text(raw?.sourceUrl, 500) || null,
      text(raw?.sourceSite, 120) || null,
      text(raw?.license, 60) || null,
      externalKey,
      raw?.crawledAt ? new Date(raw.crawledAt).toISOString() : null,
    ]);
    imported += 1;
  }

  return NextResponse.json({ imported, skipped });
}
