import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
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
  try {
  const parsed = await parseBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const mealParsed = mealKindSchema.safeParse(body.meal);
  const meal: MealKind = mealParsed.success ? mealParsed.data : "lunch";
  // v6 P1-3：营养基准库 + 实际摄入量（克）录入 —— 名称可省略（取基准库名称）
  const foodItemIdRaw = Number(body.foodItemId);
  const gramsRaw = Number(body.grams);
  const useFoodItem =
    Number.isInteger(foodItemIdRaw) && foodItemIdRaw > 0 && Number.isFinite(gramsRaw) && gramsRaw > 0;
  let name = String(body.name ?? "").trim().slice(0, 80);
  if (!name && !useFoodItem) return NextResponse.json({ error: "食物名称不能为空" }, { status: 400 });

  const dateRaw = typeof body.date === "string" ? body.date.slice(0, 10) : "";
  const date = DATE_RE.test(dateRaw) ? dateRaw : todayKey();
  const amountRaw = Number(body.amount);
  let amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.min(1000, Math.round(amountRaw * 100) / 100) : 1;
  let unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 20) : "份";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim().slice(0, 200) || null : null;

  const scope = await userScope();

  /**
   * 幂等（v3 M4 离线补发）：同一 clientId 重复提交直接返回已存在的那条。
   * 抽成闭包是因为并发补发还要在唯一索引冲突（23505）后复用同一次查询。
   */
  const findExistingByClientId = async (): Promise<Record<string, unknown> | null> => {
    if (!clientId) return null;
    const dup = scopeWhere(scope, [scope.uid, clientId]);
    const { rows: existing } = await pgPool.query<Record<string, unknown>>(
      `SELECT id, log_date AS "logDate", meal, food_id AS "foodId", name, amount, unit,
              kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG",
              created_at AS "createdAt"
         FROM meal_entries
        WHERE user_id IS NOT DISTINCT FROM $1${dup.sql} AND client_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      dup.params
    );
    return existing[0] ?? null;
  };
  const existing = await findExistingByClientId();
  if (existing) return NextResponse.json({ entry: existing, deduped: true }, { status: 200 });

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

  // v6 P1-3：营养基准库条目按 basis_amount 换算（服务端算，不信客户端）
  const round1 = (n: number) => Math.round(n * 10) / 10;
  let grams: number | null = null;
  let foodItemId: number | null = null;
  if (useFoodItem) {
    const { rows: items } = await pgPool.query<{
      id: string; name: string; basisAmount: string; basisUnit: string;
      kcal: string; proteinG: string; carbsG: string; fatG: string;
    }>(
      `SELECT id, name, basis_amount AS "basisAmount", basis_unit AS "basisUnit",
              kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"
         FROM food_items WHERE id = $1`,
      [foodItemIdRaw]
    );
    const it = items[0];
    if (!it) return NextResponse.json({ error: "未找到该食物（营养库）" }, { status: 404 });
    const basis = Number(it.basisAmount) > 0 ? Number(it.basisAmount) : 100;
    const g = Math.min(100000, Math.round(gramsRaw * 10) / 10);
    const scale = g / basis;
    grams = g;
    foodItemId = Number(it.id);
    // 名称与单位以基准库为准，避免客户端传错
    name = it.name;
    unit = it.basisUnit;
    // g/ml 直接记实量；份/碗记份数（表上 amount <= 1000，超出按 1000 记，真实克数在 grams 列）
    amount =
      it.basisUnit === "g" || it.basisUnit === "ml"
        ? Math.min(1000, g)
        : Math.min(1000, Math.round(scale * 100) / 100);
    kcal = round1(Number(it.kcal) * scale);
    proteinG = round1(Number(it.proteinG) * scale);
    carbsG = round1(Number(it.carbsG) * scale);
    fatG = round1(Number(it.fatG) * scale);
  }

  const cols = [
    "log_date", "meal", "food_id", "name", "amount", "unit",
    "kcal", "protein_g", "carbs_g", "fat_g", "client_id", "grams", "food_item_id",
  ].join(", ");
  const vals = [
    date, meal, foodId, name, amount, unit,
    round1(kcal), round1(proteinG), round1(carbsG), round1(fatG), clientId, grams, foodItemId,
  ];
  /**
   * 占位符：offset = 前面的 id 列数 + 1。
   * 除 log_date 外全部显式标注类型——可空参数（food_id / grams / food_item_id）
   * 在扩展协议里若不给类型会被 PG 判成 unknown，直接 42P18（v2.8.7 真机：匿名新增饮食 500）。
   */
  const COLUMN_TYPES = [
    "date", "text", "bigint", "text", "numeric", "text",
    "numeric", "numeric", "numeric", "numeric", "text", "numeric", "bigint",
  ] as const;
  const placeholders = (offset: number) =>
    vals.map((_, i) => `$${i + offset}::${COLUMN_TYPES[i] ?? "text"}`).join(", ");
  const returning = `id, log_date AS "logDate", meal, food_id AS "foodId", name, amount, unit,
                kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG",
                grams, food_item_id AS "foodItemId"`;

  let rows;
  try {
    if (scope.uid) {
      ({ rows } = await pgPool.query(
        `INSERT INTO meal_entries (user_id, ${cols}) VALUES ($1, ${placeholders(2)})
         RETURNING ${returning}`,
        [scope.uid, ...vals]
      ));
    } else {
      ({ rows } = await pgPool.query(
        `INSERT INTO meal_entries (user_id, anon_id, ${cols}) VALUES (NULL, $1, ${placeholders(2)})
         RETURNING ${returning}`,
        [scope.anonId, ...vals]
      ));
    }
  } catch (e) {
    /**
     * 并发补发：两个请求同时通过上面的幂等检查时，094 的部分唯一索引会让后到的
     * 那个撞 23505。这代表记录已经在库里，按幂等成功返回（200 deduped），
     * 不要回 4xx 让客户端把这条当成校验失败丢掉、也不要回 5xx 让它继续重试。
     */
    if ((e as { code?: string } | null)?.code === "23505" && clientId) {
      const raced = await findExistingByClientId();
      if (raced) return NextResponse.json({ entry: raced, deduped: true }, { status: 200 });
    }
    throw e;
  }
  return NextResponse.json({ entry: rows[0] }, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

/**
 * PATCH /api/nutrition —— 修改一条记录（v3 M3：点按条目改分量/餐次/热量）
 * body: { id, amount?, meal?, name?, unit?, kcal?, proteinG?, carbsG?, fatG? }
 * 若该条来自常用食物（food_id 非空）且只改了 amount → 服务端按食物营养 × 数量重算，避免客户端算错。
 */
export async function PATCH(req: Request) {
  const parsed = await parseBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);

  // 先取出原记录（同时完成作用域校验）
  const { rows: current } = await pgPool.query<{
    id: string; foodId: string | null; amount: string; unit: string; name: string;
    kcal: string; proteinG: string; carbsG: string; fatG: string; meal: string;
  }>(
    `SELECT id, food_id AS "foodId", amount, unit, name, kcal,
            protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG", meal
       FROM meal_entries
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL`,
    w.params
  );
  const entry = current[0];
  if (!entry) return NextResponse.json({ error: "未找到记录" }, { status: 404 });

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const clamp = (v: unknown, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(max, round1(n)) : fallback;
  };

  let amount = Number(entry.amount);
  if (body.amount !== undefined) {
    const n = Number(body.amount);
    amount = Number.isFinite(n) && n > 0 ? Math.min(1000, round1(n)) : amount;
  }

  let name = entry.name;
  if (typeof body.name === "string" && body.name.trim()) name = body.name.trim().slice(0, 80);

  let unit = entry.unit;
  if (typeof body.unit === "string" && body.unit.trim()) unit = body.unit.trim().slice(0, 20);

  let meal: MealKind = MEAL_KINDS.includes(entry.meal as MealKind) ? (entry.meal as MealKind) : "lunch";
  if (body.meal !== undefined) {
    const m = mealKindSchema.safeParse(body.meal);
    if (m.success) meal = m.data;
  }

  let kcal = clamp(body.kcal, 100000, Number(entry.kcal));
  let proteinG = clamp(body.proteinG, 10000, Number(entry.proteinG));
  let carbsG = clamp(body.carbsG, 10000, Number(entry.carbsG));
  let fatG = clamp(body.fatG, 10000, Number(entry.fatG));

  // 食物型条目 + 只改分量 → 按食物单位营养重算（客户端不必自己乘）
  const onlyAmount = body.amount !== undefined && body.kcal === undefined && body.proteinG === undefined
    && body.carbsG === undefined && body.fatG === undefined;
  if (onlyAmount && entry.foodId) {
    const { rows: foods } = await pgPool.query<{ kcal: string; proteinG: string; carbsG: string; fatG: string }>(
      `SELECT kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG"
         FROM foods WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [Number(entry.foodId), scope.uid]
    );
    const f = foods[0];
    if (f) {
      kcal = round1(Number(f.kcal) * amount);
      proteinG = round1(Number(f.proteinG) * amount);
      carbsG = round1(Number(f.carbsG) * amount);
      fatG = round1(Number(f.fatG) * amount);
    }
  }

  /**
   * 占位符从作用域参数之后开始：登录态 w.params = [uid, id]（SET 从 $3 起）；
   * 匿名态 w.params = [uid, id, anonId]（SET 从 $4 起）。
   * 旧实现写死 $3..$10，匿名时 $3 同时是 anonId 和 name，会把整条记录写坏（v2.8.7 真机走查）。
   */
  const setBase = w.params.length;
  const { rows } = await pgPool.query(
    `UPDATE meal_entries
        SET name = $${setBase + 1}, meal = $${setBase + 2}, amount = $${setBase + 3}, unit = $${setBase + 4},
            kcal = $${setBase + 5}, protein_g = $${setBase + 6}, carbs_g = $${setBase + 7}, fat_g = $${setBase + 8},
            updated_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL
      RETURNING id, log_date AS "logDate", meal, food_id AS "foodId", name, amount, unit,
                kcal, protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG",
                created_at AS "createdAt"`,
    [...w.params, name, meal, amount, unit, kcal, proteinG, carbsG, fatG]
  );
  return NextResponse.json({ entry: rows[0] });
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