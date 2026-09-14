import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { parseBody } from "@/lib/http";

const SELECT_COLS = `id, name, unit, kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"`;

/** GET /api/nutrition/foods?q= —— 常用食物库（全局种子 + 本人自定义） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
  const scope = await userScope();
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
      LIMIT 200`,
    params
  );
  return NextResponse.json({ foods: rows });
}

/** POST /api/nutrition/foods —— 保存常用食物（登录用户私有；同名 upsert） */
export async function POST(req: Request) {
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
}