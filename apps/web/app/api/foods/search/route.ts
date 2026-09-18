import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { readIntParam } from "@/lib/query";
import { mealKindSchema } from "@learn-workbench/shared";

/**
 * GET /api/foods/search?q=番茄鸡蛋面&meal=lunch&limit=20
 *
 * 营养基准库（food_items，迁移 047）模糊搜索（v6 P1-3）：
 *  - 名称 / 英文名 / 拼音 / 别名 命中（strpos，避免 LIKE 元字符转义问题）
 *  - pg_trgm similarity 容错错别字（鸡旦 → 鸡蛋）
 *  - 排序：当前餐次标签命中 → 本人近 90 天使用频次 → 相似度 → 名称
 *
 * 只读接口，匿名（anon 作用域）可用；「使用频次」部分匿名时按 anon_id 统计。
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
    if (!q) return NextResponse.json({ items: [], query: "" });
    const limit = readIntParam(url.searchParams.get("limit"), 20, 1, 50);
    const mealParsed = mealKindSchema.safeParse(url.searchParams.get("meal") ?? "");
    const meal = mealParsed.success ? mealParsed.data : null;
    const scope = await userScope();

    const { rows } = await pgPool.query(
      `WITH usage AS (
          SELECT name, COUNT(*) AS times
            FROM meal_entries
           WHERE user_id IS NOT DISTINCT FROM $1
             AND deleted_at IS NULL
             AND created_at >= now() - interval '90 days'
           GROUP BY name
       )
       SELECT fi.id, fi.name, fi.category, fi.meal_tags AS "mealTags",
              fi.basis_amount AS "basisAmount", fi.basis_unit AS "basisUnit",
              fi.kcal, fi.protein_g AS "proteinG", fi.carbs_g AS "carbsG", fi.fat_g AS "fatG",
              fi.source, fi.license,
              GREATEST(similarity(fi.name, $2), COALESCE(similarity(fi.name_en, $2), 0))::float AS score,
              COALESCE(u.times, 0)::int AS "times"
         FROM food_items fi
         LEFT JOIN usage u ON lower(u.name) = lower(fi.name)
        WHERE strpos(lower(fi.name), lower($2)) > 0
           OR strpos(lower(COALESCE(fi.name_en, '')), lower($2)) > 0
           OR strpos(lower(COALESCE(fi.pinyin, '')), lower($2)) > 0
           OR EXISTS (SELECT 1 FROM unnest(fi.aliases) AS a WHERE strpos(lower(a), lower($2)) > 0)
           OR similarity(fi.name, $2) > 0.25
        ORDER BY (CASE WHEN $3::text IS NOT NULL AND fi.meal_tags @> ARRAY[$3::text] THEN 1 ELSE 0 END) DESC,
                 COALESCE(u.times, 0) DESC,
                 score DESC,
                 fi.name
        LIMIT ${limit}`,
      [scope.uid, q, meal]
    );
    return NextResponse.json({ items: rows, query: q, meal });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
