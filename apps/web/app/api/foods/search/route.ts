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
 *  - **字符覆盖率**容错错别字（鸡旦 → 鸡蛋）；不用 pg_trgm 的 similarity：它对纯中文恒为 0（踩坑 81）
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
              s.score,
              COALESCE(u.times, 0)::int AS "times"
         FROM food_items fi
         LEFT JOIN usage u ON lower(u.name) = lower(fi.name)
         CROSS JOIN LATERAL (
           SELECT
             -- 中文友好相似度：查询串的**字符覆盖率**。
             -- ⚠️ 不要用 pg_trgm 的 similarity()：实测 show_trgm('番茄鸡蛋面') = {} ——
             --    pg_trgm 只把字母数字当词，纯中文不生成 trigram，similarity 恒为 0（踩坑 81）。
             (SELECT count(DISTINCT ch)::float
                FROM unnest(regexp_split_to_array(lower(fi.name), '')) AS ch
               WHERE ch IN (SELECT unnest(regexp_split_to_array(lower($2::text), '')))
             ) / GREATEST(length($2::text), 1)::float AS score,
             (CASE WHEN strpos(lower(fi.name), lower($2::text)) > 0
                     OR strpos(lower(COALESCE(fi.name_en, '')), lower($2::text)) > 0
                     OR strpos(lower(COALESCE(fi.pinyin, '')), lower($2::text)) > 0
                     OR EXISTS (SELECT 1 FROM unnest(fi.aliases) AS a WHERE strpos(lower(a), lower($2::text)) > 0)
                   THEN 1 ELSE 0 END) AS hit
         ) s
        WHERE s.hit = 1 OR s.score >= 0.5
        ORDER BY (CASE WHEN $3::text IS NOT NULL AND fi.meal_tags @> ARRAY[$3::text] THEN 1 ELSE 0 END) DESC,
                 s.hit DESC, COALESCE(u.times, 0) DESC, s.score DESC, fi.name
        LIMIT ${limit}`,
      [scope.uid, q, meal]
    );
    // numeric 列经 node-pg 是字符串：统一转成数字再返回（与 /api/nutrition 的映射口径一致）
    const items = rows.map((r) => ({
      ...r,
      id: Number(r.id),
      basisAmount: Number(r.basisAmount),
      kcal: Number(r.kcal),
      proteinG: Number(r.proteinG),
      carbsG: Number(r.carbsG),
      fatG: Number(r.fatG),
    }));
    return NextResponse.json({ items, query: q, meal });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
