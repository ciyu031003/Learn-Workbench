import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import {
  ACTIVITY_LEVELS,
  buildNutritionTargetView,
  type ActivityLevel,
  type Sex,
} from "@learn-workbench/shared";

const DEFAULT_WEIGHT_KG = 60;

interface ProfileRow {
  weightKg: string | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: string | null;
  activityLevel: string | null;
  targetKcal: string | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
}

const SELECT_COLS = `weight_kg AS "weightKg", height_cm AS "heightCm", birth_year AS "birthYear",
  sex, activity_level AS "activityLevel", nutrition_target_kcal AS "targetKcal",
  protein_target_g AS "proteinG", carbs_target_g AS "carbsG", fat_target_g AS "fatG"`;

async function loadProfile(): Promise<{ row: ProfileRow | null; scope: Awaited<ReturnType<typeof userScope>> }> {
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid]);
  const { rows } = await pgPool.query<ProfileRow>(
    `SELECT ${SELECT_COLS} FROM user_settings
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} LIMIT 1`,
    w.params
  );
  return { row: rows[0] ?? null, scope };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toView(row: ProfileRow | null) {
  const weightKg = row?.weightKg ? Number(row.weightKg) : DEFAULT_WEIGHT_KG;
  const sex = row?.sex === "male" || row?.sex === "female" ? (row.sex as Sex) : null;
  const activityLevel =
    row?.activityLevel && (ACTIVITY_LEVELS as readonly string[]).includes(row.activityLevel)
      ? (row.activityLevel as ActivityLevel)
      : null;
  return buildNutritionTargetView(
    {
      weightKg,
      heightCm: row?.heightCm ?? null,
      birthYear: row?.birthYear ?? null,
      sex,
      activityLevel,
    },
    {
      kcal: num(row?.targetKcal),
      proteinG: num(row?.proteinG),
      carbsG: num(row?.carbsG),
      fatG: num(row?.fatG),
    }
  );
}

/** GET /api/nutrition/target —— 身体数据 + 有效目标（自动算或手动覆盖） */
export async function GET() {
  const { row } = await loadProfile();
  return NextResponse.json({
    profile: {
      weightKg: row?.weightKg ? Number(row.weightKg) : DEFAULT_WEIGHT_KG,
      heightCm: row?.heightCm ?? null,
      birthYear: row?.birthYear ?? null,
      sex: row?.sex ?? null,
      activityLevel: row?.activityLevel ?? null,
    },
    overrides: {
      kcal: num(row?.targetKcal),
      proteinG: num(row?.proteinG),
      carbsG: num(row?.carbsG),
      fatG: num(row?.fatG),
    },
    target: toView(row),
  });
}

/**
 * PUT /api/nutrition/target —— 保存身体数据与（可选）手动目标
 * body: { weightKg?, heightCm?, birthYear?, sex?, activityLevel?, kcal?, proteinG?, carbsG?, fatG? }
 * 传 null 表示清空该项（回到自动算）。
 */
export async function PUT(req: Request) {
  const parsed = await parseBody(req, 64 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const clampOpt = (v: unknown, min: number, max: number): number | null => {
    if (v === null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(Math.min(max, Math.max(min, n)));
  };

  const weightKg = clampOpt(body.weightKg, 20, 300);
  const heightCm = clampOpt(body.heightCm, 100, 250);
  const birthYear = clampOpt(body.birthYear, 1900, 2100);
  const sex = body.sex === "male" || body.sex === "female" ? (body.sex as string) : null;
  const activityLevel =
    typeof body.activityLevel === "string" && (ACTIVITY_LEVELS as readonly string[]).includes(body.activityLevel)
      ? body.activityLevel
      : null;
  const targetKcal = body.kcal === undefined ? undefined : clampOpt(body.kcal, 800, 6000);
  const proteinG = body.proteinG === undefined ? undefined : clampOpt(body.proteinG, 10, 400);
  const carbsG = body.carbsG === undefined ? undefined : clampOpt(body.carbsG, 10, 800);
  const fatG = body.fatG === undefined ? undefined : clampOpt(body.fatG, 5, 300);

  const scope = await userScope();
  const base = {
    weight_kg: weightKg ?? DEFAULT_WEIGHT_KG,
    height_cm: heightCm,
    birth_year: birthYear,
    sex,
    activity_level: activityLevel,
  };
  const optional: Record<string, number | null> = {};
  if (targetKcal !== undefined) optional.nutrition_target_kcal = targetKcal;
  if (proteinG !== undefined) optional.protein_target_g = proteinG;
  if (carbsG !== undefined) optional.carbs_target_g = carbsG;
  if (fatG !== undefined) optional.fat_target_g = fatG;

  const cols = [...Object.keys(base), ...Object.keys(optional)];
  const vals = [...Object.values(base), ...Object.values(optional)];

  if (scope.uid) {
    const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
    const updates = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
    await pgPool.query(
      `INSERT INTO user_settings (user_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})
       ON CONFLICT (user_id) WHERE user_id IS NOT NULL
       DO UPDATE SET ${updates}, updated_at = now()`,
      [scope.uid, ...vals]
    );
  } else {
    const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
    const updates = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
    await pgPool.query(
      `INSERT INTO user_settings (anon_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})
       ON CONFLICT (anon_id) WHERE user_id IS NULL AND anon_id IS NOT NULL
       DO UPDATE SET ${updates}, updated_at = now()`,
      [scope.anonId, ...vals]
    );
  }

  const { row } = await loadProfile();
  return NextResponse.json({
    profile: {
      weightKg: row?.weightKg ? Number(row.weightKg) : DEFAULT_WEIGHT_KG,
      heightCm: row?.heightCm ?? null,
      birthYear: row?.birthYear ?? null,
      sex: row?.sex ?? null,
      activityLevel: row?.activityLevel ?? null,
    },
    target: toView(row),
  });
}
