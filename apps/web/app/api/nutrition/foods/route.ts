import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { readIntParam } from "@/lib/query";
import { mealKindSchema } from "@learn-workbench/shared";

const SELECT_COLS = `id, name, unit, kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"`;

/** GET /api/nutrition/foods?q= —— 常用食物库（全局种子 + 本人自定义）
 *  ?sort=recent —— 按「最近使用 / 使用频次」排序（v3 M4「一点即记」与 M9 贴纸墙的数据源），
 *  统计口径来自近 90 天的 meal_entries，不需要新表。
 *  ?meal=breakfast|lunch|dinner|snack —— v6 P1-2：先看**本人该餐次**的频次，再回落到总体频次
 *  （早餐常吃的包子不会因为中午也吃过而被淹没）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
  const sort = url.searchParams.get("sort") === "recent" ? "recent" : "name";
  // 注意：缺失 limit 时不能用 Number(null)=0 去钳位（会退化成 LIMIT 1）
  const limit = readIntParam(url.searchParams.get("limit"), 200, 1, 200);
  const mealParsed = mealKindSchema.safeParse(url.searchParams.get("meal") ?? "");
  const meal = mealParsed.success ? mealParsed.data : null;
  const scope = await userScope();

  if (sort === "recent") {
    // 频次与最近使用：以本人 meal_entries 的 name 聚合（food_id 可能为空的手动条目也能收集起来）
    // $2 = 当前餐次（可为 null → 该两项恒为 0/NULL，排序退化成原来的总体频次）
    const params: unknown[] = [scope.uid, meal];
    let qSql = "";
    if (q) {
      params.push(`%${q}%`);
      // 必须限定 f.name：usage CTE 里也有 name，不限定会报 ambiguous column
      qSql = ` AND f.name ILIKE $${params.length}`;
    }
    const { rows } = await pgPool.query(
      `WITH usage AS (
          SELECT name,
                 COUNT(*) AS times,
                 MAX(created_at) AS last_used,
                 COUNT(*) FILTER (WHERE meal = $2) AS meal_times,
                 MAX(created_at) FILTER (WHERE meal = $2) AS meal_last_used
            FROM meal_entries
           WHERE user_id IS NOT DISTINCT FROM $1
             AND deleted_at IS NULL
             AND created_at >= now() - interval '90 days'
           GROUP BY name
       )
       SELECT f.id, f.name, f.unit, f.kcal, f.protein_g AS "proteinG", f.carbs_g AS "carbsG", f.fat_g AS "fatG",
              COALESCE(u.times, 0)::int AS "times",
              u.last_used AS "lastUsed",
              COALESCE(u.meal_times, 0)::int AS "mealTimes"
         FROM foods f
         LEFT JOIN usage u ON lower(u.name) = lower(f.name)
        WHERE (f.user_id IS NULL OR f.user_id = $1)${qSql}
        ORDER BY COALESCE(u.meal_times, 0) DESC, u.meal_last_used DESC NULLS LAST,
                 COALESCE(u.times, 0) DESC, u.last_used DESC NULLS LAST, (f.user_id IS NULL), f.name
        LIMIT ${limit}`,
      params
    );
    return NextResponse.json({ foods: rows, sort, meal });
  }

  const params: unknown[] = [scope.uid];
  let qSql = "";
  if (q) {
    params.push(`%${q}%`);
    qSql = ` AND name ILIKE $${params.length}`;
  }

  const { rows } = await pgPool.query(
    `SELECT ${SELECT_COLS} FROM foods
      WHERE (user_id IS NULL OR user_id = $1)${qSql}
      ORDER BY (user_id IS NULL), name
      LIMIT ${limit}`,
    params
  );
  return NextResponse.json({ foods: rows, sort, meal });
}

/** POST /api/nutrition/foods —— 保存常用食物（登录用户私有；同名 upsert） */
export async function POST(req: Request) {
  try {
  const parsed = await parseBody(req, 64 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const userId = (await userScope()).uid;
  if (!userId) return NextResponse.json({ error: "登录后可保存常用食物" }, { status: 401 });

  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "食物名称不能为空" }, { status: 400 });
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 20) : "份";
  const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round((Number(v) || 0) * 10) / 10));

  const { rows } = await pgPool.query(
    `INSERT INTO foods (user_id, name, unit, kcal, protein_g, carbs_g, fat_g)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, lower(name)) WHERE user_id IS NOT NULL
     DO UPDATE SET unit = EXCLUDED.unit, kcal = EXCLUDED.kcal, protein_g = EXCLUDED.protein_g,
       carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g, updated_at = now()
     RETURNING ${SELECT_COLS}`,
    [userId, name, unit, num(body.kcal, 10000), num(body.proteinG, 1000), num(body.carbsG, 1000), num(body.fatG, 1000)]
  );
  return NextResponse.json({ food: rows[0] }, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}