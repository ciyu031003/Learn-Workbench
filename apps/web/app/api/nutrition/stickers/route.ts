import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { readIntParam } from "@/lib/query";

const MAX_DAYS = 365;

/**
 * GET /api/nutrition/stickers?days=30&limit=60
 *
 * 「我的饮食日记」收集册（v3 M9 深化）：按**食物名**聚合一段时间内的记录，
 * 给出出现次数、累计/平均热量、首末日期，供移动端渲染 emoji 贴纸墙。
 *
 * 与 `/api/nutrition/foods?sort=recent` 的区别：那个从 `foods` 表出发（只含常用食物库里的条目），
 * 这里从 `meal_entries` 出发 —— **手动录入、没进食物库的名字同样会被收集**。
 * 只读、不新建表。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // 注意：缺失参数不能用 Number(null)=0 去钳位（会变成 1 天/1 条）
  const days = readIntParam(url.searchParams.get("days"), 30, 1, MAX_DAYS);
  const limit = readIntParam(url.searchParams.get("limit"), 60, 1, 200);

  try {
    const scope = await userScope();
    const w = scopeWhere(scope, [scope.uid, days]);
    const { rows } = await pgPool.query<{
      name: string;
      times: string;
      totalKcal: string;
      avgKcal: string;
      firstDate: string;
      lastDate: string;
    }>(
      `SELECT name,
              COUNT(*)::text                    AS times,
              COALESCE(SUM(kcal), 0)::text      AS "totalKcal",
              COALESCE(AVG(kcal), 0)::text      AS "avgKcal",
              MIN(log_date)::text               AS "firstDate",
              MAX(log_date)::text               AS "lastDate"
         FROM meal_entries
        WHERE user_id IS NOT DISTINCT FROM $1${w.sql}
          AND deleted_at IS NULL
          AND log_date >= (CURRENT_DATE - ($2::int - 1))
        GROUP BY name
        ORDER BY COUNT(*) DESC, MAX(log_date) DESC
        LIMIT ${limit}`,
      w.params
    );

    const stickers = rows.map((r) => ({
      name: r.name,
      times: Number(r.times),
      totalKcal: Math.round(Number(r.totalKcal)),
      avgKcal: Math.round(Number(r.avgKcal)),
      firstDate: String(r.firstDate).slice(0, 10),
      lastDate: String(r.lastDate).slice(0, 10),
    }));

    return NextResponse.json({
      days,
      totalKinds: stickers.length,
      totalTimes: stickers.reduce((a, s) => a + s.times, 0),
      stickers,
    });
  } catch (e) {
    return dbErrorResponse(e, "暂时读不到收集册");
  }
}
