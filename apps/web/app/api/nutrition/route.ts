import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { mealKindSchema, sumNutrition, type MealKind } from "@learn-workbench/shared";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** GET /api/nutrition?date=YYYY-MM-DD —— 当日饮食条目 + 汇总 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateRaw = (url.searchParams.get("date") ?? "").slice(0, 10);
  const date = DATE_RE.test(dateRaw) ? dateRaw : todayKey();

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, date]);
  const { rows } = await pgPool.query<{
    id: string; logDate: string; meal: string; foodId: string | null; name: string;
    amount: string; unit: string; kcal: string; proteinG: string; carbsG: string; fatG: string;
    createdAt: string;
  }>(
    `SELECT id, log_date AS "logDate", meal, food_id AS "foodId", name, amount, unit,
            kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG",
            created_at AS "createdAt"
       FROM meal_entries
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND log_date = $2::date AND deleted_at IS NULL
      ORDER BY meal, id`,
    w.params
  );
  const entries = rows.map((r) => ({
    id: Number(r.id),
    logDate: String(r.logDate).slice(0, 10),
    meal: r.meal as MealKind,
    foodId: r.foodId === null ? null : Number(r.foodId),
    name: r.name,
    amount: Number(r.amount),
    unit: r.unit,
    kcal: Number(r.kcal),
    proteinG: Number(r.proteinG),
    carbsG: Number(r.carbsG),
    fatG: Number(r.fatG),
    // 时间线用（v3 M3）：显式 ISO，避免不同驱动把 Date 序列化成对象
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
  }));
  return NextResponse.json({ date, entries, totals: sumNutrition(entries) });
}

/**
 * POST /api/nutrition —— 新增饮食条目
 * body: { date?, meal, name, amount?, unit?, kcal?, proteinG?, carbsG?, fatG?, foodId? }
 * 若给 foodId，则按所选食物的单位营养 × amount 自动计算（前端也可直接传数值）。
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const mealParsed = mealKindSchema.safeParse(body.meal);
  const meal: MealKind = mealParsed.success ? mealParsed.data : "lunch";
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "食物名称不能为空" }, { status: 400 });

  const dateRaw = typeof body.date === "string" ? body.date.slice(0, 10) : "";
  const date = DATE_RE.test(dateRaw) ? dateRaw : todayKey();
  const amountRaw = Number(body.amount);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.min(1000, Math.round(amountRaw * 100) / 100) : 1;
  let unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 20) : "份";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim().slice(0, 200) || null : null;

  const scope = await userScope();
  let foodId: number | null = null;
  let kcal = Math.max(0, Number(body.kcal) || 0);
  let proteinG = Math.max(0, Number(body.proteinG) || 0);
  let carbsG = Math.max(0, Number(body.carbsG) || 0);
  let fatG = Math.max(0, Number(body.fatG) || 0);

  const foodIdRaw = Number(body.foodId);
  if (Number.isInteger(foodIdRaw) && foodIdRaw > 0) {
    // 归属：全局食物(user_id IS NULL) 或本人食物
    const { rows } = await pgPool.query<{ id: string; unit: string; kcal: string; proteinG: string; carbsG: string; fatG: string }>(
      `SELECT id, unit, kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"
         FROM foods WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [foodIdRaw, scope.uid]
    );
    const f = rows[0];
    if (!f) return NextResponse.json({ error: "未找到食物" }, { status: 404 });
    foodId = Number(f.id);
    unit = unit === "份" ? f.unit : unit;
    kcal = Number(f.kcal) * amount;
    proteinG = Number(f.proteinG) * amount;
    carbsG = Number(f.carbsG) * amount;
    fatG = Number(f.fatG) * amount;
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const cols = `log_date, meal, food_id, name, amount, unit, kcal, protein_g, carbs_g, fat_g, client_id`;
  const vals = [date, meal, foodId, name, amount, unit, round1(kcal), round1(proteinG), round1(carbsG), round1(fatG), clientId];

  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO meal_entries (user_id, ${cols}) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, log_date AS "logDate", meal, food_id AS "foodId", name, amount, unit,
                 kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"`,
      [scope.uid, ...vals]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO meal_entries (user_id, anon_id, ${cols}) VALUES (NULL,$1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, log_date AS "logDate", meal, food_id AS "foodId", name, amount, unit,
                 kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"`,
      [scope.anonId, ...vals]
    ));
  }
  return NextResponse.json({ entry: rows[0] }, { status: 201 });
}

/** DELETE /api/nutrition?id= —— 软删除条目 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE meal_entries SET deleted_at = now() WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2`,
    w.params
  );
  return NextResponse.json({ ok: true });
}

export const MEAL_KINDS = MEALS;