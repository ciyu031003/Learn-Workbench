import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { rateLimit } from "@/lib/rate-limit";
import { mealKindSchema } from "@learn-workbench/shared";

/**
 * POST /api/foods/contribute
 *
 * 用户手动录入的食材 → 公共食物库（food_items）。
 * - 登录/匿名均可提交；submitter 仅用于审计，不在搜索接口返回。
 * - 同名（忽略大小写）已存在时直接返回已有条目，created=false。
 * - 只接受食物名称/单位/营养值，不接受备注等自由文本。
 */
const SELECT_COLS = `
  id, name, category,
  meal_tags AS "mealTags",
  basis_amount AS "basisAmount",
  basis_unit AS "basisUnit",
  kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG",
  source, license
`;

function mapRow(row: Record<string, unknown>) {
  return {
    ...row,
    id: Number(row.id),
    basisAmount: Number(row.basisAmount),
    kcal: Number(row.kcal),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    mealTags: Array.isArray(row.mealTags) ? row.mealTags : [],
  };
}

function readNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "食物名称需为 1-80 个字符" }, { status: 400 });
    }
    const unitRaw = typeof body.unit === "string" ? body.unit.trim() : "";
    const unit = (unitRaw || "份").slice(0, 16);
    const kcal = readNumber(body.kcal, 0, 100000);
    const proteinG = readNumber(body.proteinG ?? 0, 0, 10000);
    const carbsG = readNumber(body.carbsG ?? 0, 0, 10000);
    const fatG = readNumber(body.fatG ?? 0, 0, 10000);
    if (kcal === null || proteinG === null || carbsG === null || fatG === null) {
      return NextResponse.json({ error: "营养值不合法" }, { status: 400 });
    }

    const mealParsed = mealKindSchema.safeParse(typeof body.meal === "string" ? body.meal : "");
    const mealTags = mealParsed.success ? [mealParsed.data] : [];
    const scope = await userScope();


    const existing = await pgPool.query(
      `SELECT ${SELECT_COLS} FROM food_items
        WHERE lower(name) = lower($1) AND status = 'approved'
        ORDER BY CASE WHEN source = 'builtin' THEN 0 WHEN source = 'user' THEN 1 ELSE 2 END, id
        LIMIT 1`,
      [name]
    );
    if (existing.rows[0]) {
      return NextResponse.json({ item: mapRow(existing.rows[0]), created: false });
    }

    // 只对「真的要写新行」的请求限流：同名回读不算刷库。
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
    const limited = await rateLimit(`food-contribute:${scope.uid ?? scope.anonId ?? ip ?? "unknown"}`, {
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "提交过于频繁，请稍后再试", retryAfter: limited.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const inserted = await pgPool.query(
      `INSERT INTO food_items (
         source, source_id, name, category, meal_tags, basis_amount, basis_unit,
         kcal, protein_g, carbs_g, fat_g, license,
         status, submitted_by_user_id, submitted_by_anon_id, submitted_at
       ) VALUES (
         'user', 'user:' || md5(lower($1)), $1, '用户添加', $2::text[], 1, $3,
         $4, $5, $6, $7, 'user-contributed',
         'approved', $8::uuid, $9, now()
       )
       ON CONFLICT DO NOTHING
       RETURNING ${SELECT_COLS}`,
      [name, mealTags, unit, kcal, proteinG, carbsG, fatG, scope.uid, scope.anonId]
    );
    if (inserted.rows[0]) {
      return NextResponse.json({ item: mapRow(inserted.rows[0]), created: true }, { status: 201 });
    }

    // 并发提交同一个名称：唯一索引让其中一条 DO NOTHING，这里回读赢家。
    const raced = await pgPool.query(
      `SELECT ${SELECT_COLS} FROM food_items
        WHERE lower(name) = lower($1) AND status = 'approved' LIMIT 1`,
      [name]
    );
    if (raced.rows[0]) {
      return NextResponse.json({ item: mapRow(raced.rows[0]), created: false });
    }
    return NextResponse.json({ error: "正在收录，请稍后重试" }, { status: 409 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
