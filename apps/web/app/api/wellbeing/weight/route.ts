import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 365;

interface WeightRow {
  id: string;
  logDate: string;
  weightKg: string;
}

/**
 * GET /api/wellbeing/weight?days=30[&end=YYYY-MM-DD]
 * 体重记录（默认近 30 天，升序），供趋势图与 7 日均线使用。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days"));
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(MAX_DAYS, Math.round(daysRaw))) : 30;
  const endRaw = (url.searchParams.get("end") ?? "").slice(0, 10);
  const end = DATE_RE.test(endRaw) ? endRaw : null;

  const scope = await userScope();
  const base: unknown[] = end ? [scope.uid, end, days] : [scope.uid, days];
  const w = scopeWhere(scope, base);
  const endExpr = end ? "$2::date" : "CURRENT_DATE";
  const daysIdx = end ? "$3" : "$2";

  const { rows } = await pgPool.query<WeightRow>(
    `SELECT id, log_date AS "logDate", weight_kg AS "weightKg"
       FROM weight_logs
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql}
        AND deleted_at IS NULL
        AND log_date >= (${endExpr} - (${daysIdx}::int - 1))
        AND log_date <= ${endExpr}
      ORDER BY log_date`,
    w.params
  );

  const points = rows.map((r) => ({
    id: Number(r.id),
    date: String(r.logDate).slice(0, 10),
    weightKg: Number(r.weightKg),
  }));
  const latest = points.length > 0 ? points[points.length - 1] : null;
  return NextResponse.json({ days, points, latest });
}

/**
 * POST /api/wellbeing/weight —— 记录体重（同日 upsert）
 * body: { date?, weightKg, note? }
 * 同时把 user_settings.weight_kg 更新为最新值（MET 卡路里估算依赖它）。
 */
export async function POST(req: Request) {
  try {
  const parsed = await parseBody(req, 32 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const raw = Number(body.weightKg);
  if (!Number.isFinite(raw) || raw <= 0) {
    return NextResponse.json({ error: "体重需在 20-300 kg 之间" }, { status: 400 });
  }
  const weightKg = Math.min(300, Math.max(20, Math.round(raw * 10) / 10));
  const dateRaw = typeof body.date === "string" ? body.date.slice(0, 10) : "";
  const date = DATE_RE.test(dateRaw) ? dateRaw : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;

  const scope = await userScope();

  if (scope.uid) {
    await pgPool.query(
      `INSERT INTO weight_logs (user_id, log_date, weight_kg, note)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4)
       ON CONFLICT (user_id, log_date) WHERE deleted_at IS NULL AND user_id IS NOT NULL
       DO UPDATE SET weight_kg = EXCLUDED.weight_kg, note = EXCLUDED.note, updated_at = now()`,
      [scope.uid, date, weightKg, note]
    );
    // 同步最新体重（卡路里估算读 user_settings.weight_kg）
    await pgPool.query(
      `INSERT INTO user_settings (user_id, weight_kg) VALUES ($1, $2)
       ON CONFLICT (user_id) WHERE user_id IS NOT NULL
       DO UPDATE SET weight_kg = EXCLUDED.weight_kg, updated_at = now()`,
      [scope.uid, weightKg]
    );
  } else {
    await pgPool.query(
      `INSERT INTO weight_logs (anon_id, log_date, weight_kg, note)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4)
       ON CONFLICT (anon_id, log_date) WHERE deleted_at IS NULL AND user_id IS NULL AND anon_id IS NOT NULL
       DO UPDATE SET weight_kg = EXCLUDED.weight_kg, note = EXCLUDED.note, updated_at = now()`,
      [scope.anonId, date, weightKg, note]
    );
    await pgPool.query(
      `INSERT INTO user_settings (anon_id, weight_kg) VALUES ($1, $2)
       ON CONFLICT (anon_id) WHERE user_id IS NULL AND anon_id IS NOT NULL
       DO UPDATE SET weight_kg = EXCLUDED.weight_kg, updated_at = now()`,
      [scope.anonId, weightKg]
    );
  }

  return NextResponse.json({ ok: true, weightKg }, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

/** DELETE /api/wellbeing/weight?id= —— 删除一条体重记录（软删） */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE weight_logs SET deleted_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL`,
    w.params
  );
  return NextResponse.json({ ok: true });
}
