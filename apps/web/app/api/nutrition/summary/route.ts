import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

/**
 * GET /api/nutrition/summary?days=7[&end=YYYY-MM-DD]
 * 近 N 天每日汇总（只读，供日期条画 ✓ 与迷你趋势用）。
 * 一次 SQL `GROUP BY log_date`，避免客户端连打 7 次明细接口。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days"));
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(MAX_DAYS, Math.round(daysRaw))) : 7;
  const endRaw = (url.searchParams.get("end") ?? "").slice(0, 10);
  const end = DATE_RE.test(endRaw) ? endRaw : null;

  const scope = await userScope();
  // 以 end（默认今天）为终点，取 days 天窗口
  const endExpr = end ? "$2::date" : "CURRENT_DATE";
  const base: unknown[] = end ? [scope.uid, end, days] : [scope.uid, days];
  const w = scopeWhere(scope, base);
  const daysIdx = end ? "$3" : "$2";

  const { rows } = await pgPool.query<{
    date: string; kcal: string; proteinG: string; carbsG: string; fatG: string; entryCount: string;
  }>(
    `SELECT d::date AS date,
            COALESCE(SUM(m.kcal), 0)      AS kcal,
            COALESCE(SUM(m.protein_g), 0) AS "proteinG",
            COALESCE(SUM(m.carbs_g), 0)   AS "carbsG",
            COALESCE(SUM(m.fat_g), 0)     AS "fatG",
            COUNT(m.id)                   AS "entryCount"
       FROM generate_series(${endExpr} - (${daysIdx}::int - 1), ${endExpr}, interval '1 day') AS d
       LEFT JOIN meal_entries m
              ON m.log_date = d::date
             AND m.deleted_at IS NULL
             AND m.user_id IS NOT DISTINCT FROM $1${w.sql}
      GROUP BY d
      ORDER BY d`,
    w.params
  );

  return NextResponse.json({
    days,
    summary: rows.map((r) => ({
      date: String(r.date).slice(0, 10),
      kcal: Math.round(Number(r.kcal)),
      proteinG: Math.round(Number(r.proteinG)),
      carbsG: Math.round(Number(r.carbsG)),
      fatG: Math.round(Number(r.fatG)),
      entryCount: Number(r.entryCount),
    })),
  });
}
