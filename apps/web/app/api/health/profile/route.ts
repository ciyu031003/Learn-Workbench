import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import {
  ACTIVITY_LEVELS,
  buildEnergyPlan,
  type ActivityLevel,
  type HealthGoal,
  type ReminderPrefs,
  type Sex,
} from "@learn-workbench/shared";

const DEFAULT_WEIGHT_KG = 60;
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

interface ProfileRow {
  weightKg: string | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: string | null;
  activityLevel: string | null;
  bodyGoal: string | null;
  trainingDaysPerWeek: number | null;
  sleepTargetMinutes: number | null;
  bedtimeTarget: string | null;
  reminderPrefs: unknown;
}

const SELECT_COLS = `weight_kg AS "weightKg", height_cm AS "heightCm", birth_year AS "birthYear",
  sex, activity_level AS "activityLevel", body_goal AS "bodyGoal",
  training_days_per_week AS "trainingDaysPerWeek", sleep_target_minutes AS "sleepTargetMinutes",
  bedtime_target AS "bedtimeTarget", reminder_prefs AS "reminderPrefs"`;

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

function cleanSex(v: unknown): Sex | null {
  return v === "male" || v === "female" ? v : null;
}

function cleanActivity(v: unknown): ActivityLevel | null {
  return typeof v === "string" && (ACTIVITY_LEVELS as readonly string[]).includes(v)
    ? (v as ActivityLevel)
    : null;
}

function cleanGoal(v: unknown): HealthGoal | null {
  return v === "lose" || v === "maintain" || v === "gain" ? v : null;
}

function cleanTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const text = v.trim();
  return TIME_RE.test(text) ? text : null;
}

/** 提醒偏好只接受白名单字段，避免把任意 JSON 写进库 */
export function cleanReminderPrefs(raw: unknown): ReminderPrefs {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: ReminderPrefs = {};
  if (typeof obj.earlySleep === "boolean") out.earlySleep = obj.earlySleep;
  if (typeof obj.protein === "boolean") out.protein = obj.protein;
  const start = cleanTime(obj.quietStart);
  const end = cleanTime(obj.quietEnd);
  if (start && end && start !== end) {
    out.quietStart = start;
    out.quietEnd = end;
  }
  return out;
}

function parsePrefs(v: unknown): ReminderPrefs {
  if (typeof v === "string") {
    try {
      return cleanReminderPrefs(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return cleanReminderPrefs(v);
}

function toView(row: ProfileRow | null) {
  const weightKg = row?.weightKg ? Number(row.weightKg) : DEFAULT_WEIGHT_KG;
  const sex = cleanSex(row?.sex);
  const activityLevel = cleanActivity(row?.activityLevel);
  const bodyGoal = cleanGoal(row?.bodyGoal);
  const trainingDaysPerWeek =
    row?.trainingDaysPerWeek === null || row?.trainingDaysPerWeek === undefined
      ? null
      : Number(row.trainingDaysPerWeek);
  const sleepTargetMinutes =
    row?.sleepTargetMinutes === null || row?.sleepTargetMinutes === undefined
      ? 450
      : Number(row.sleepTargetMinutes);
  const bedtimeTarget = cleanTime(row?.bedtimeTarget) ?? "23:30";
  const plan = buildEnergyPlan({
    weightKg,
    heightCm: row?.heightCm ?? null,
    birthYear: row?.birthYear ?? null,
    sex,
    activityLevel,
    bodyGoal,
    trainingDaysPerWeek,
  });
  return {
    profile: {
      weightKg,
      heightCm: row?.heightCm ?? null,
      birthYear: row?.birthYear ?? null,
      sex,
      activityLevel,
      bodyGoal: bodyGoal ?? "maintain",
      trainingDaysPerWeek,
      sleepTargetMinutes,
      bedtimeTarget,
      reminderPrefs: parsePrefs(row?.reminderPrefs),
    },
    plan,
  };
}

/** GET /api/health/profile —— 身体数据、目标、睡眠目标与提醒偏好 */
export async function GET() {
  try {
    const { row } = await loadProfile();
    return NextResponse.json(toView(row));
  } catch (e) {
    return dbErrorResponse(e);
  }
}

/**
 * PUT /api/health/profile
 * 只更新显式传入的字段；null 表示清空（weightKg 例外，回落到默认 60）。
 * body: { weightKg?, heightCm?, birthYear?, sex?, activityLevel?, bodyGoal?,
 *         trainingDaysPerWeek?, sleepTargetMinutes?, bedtimeTarget?, reminderPrefs? }
 */
export async function PUT(req: Request) {
  try {
    const parsed = await parseBody(req, 64 * 1024);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const body = (parsed.data ?? {}) as Record<string, unknown>;

    const fields: Record<string, unknown> = {};
    const clampOpt = (v: unknown, min: number, max: number): number | null => {
      if (v === null) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return null;
      return Math.round(Math.min(max, Math.max(min, n)));
    };

    if ("weightKg" in body) fields.weight_kg = clampOpt(body.weightKg, 20, 300) ?? DEFAULT_WEIGHT_KG;
    if ("heightCm" in body) fields.height_cm = clampOpt(body.heightCm, 100, 250);
    if ("birthYear" in body) fields.birth_year = clampOpt(body.birthYear, 1900, 2100);
    if ("sex" in body) fields.sex = cleanSex(body.sex);
    if ("activityLevel" in body) fields.activity_level = cleanActivity(body.activityLevel);
    if ("bodyGoal" in body) fields.body_goal = cleanGoal(body.bodyGoal);
    if ("trainingDaysPerWeek" in body) {
      const n = Number(body.trainingDaysPerWeek);
      fields.training_days_per_week =
        body.trainingDaysPerWeek === null || !Number.isFinite(n)
          ? null
          : Math.round(Math.min(7, Math.max(0, n)));
    }
    if ("sleepTargetMinutes" in body) {
      const n = Number(body.sleepTargetMinutes);
      fields.sleep_target_minutes =
        body.sleepTargetMinutes === null || !Number.isFinite(n)
          ? null
          : Math.round(Math.min(720, Math.max(300, n)));
    }
    if ("bedtimeTarget" in body) fields.bedtime_target = cleanTime(body.bedtimeTarget);
    if ("reminderPrefs" in body) fields.reminder_prefs = JSON.stringify(cleanReminderPrefs(body.reminderPrefs));

    const cols = Object.keys(fields);
    if (cols.length === 0) return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });

    const scope = await userScope();
    const vals = cols.map((c) => fields[c]);
    const placeholders = cols.map((_, i) => `$${i + 2}`).join(", ");
    const updates = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");

    if (scope.uid) {
      await pgPool.query(
        `INSERT INTO user_settings (user_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})
         ON CONFLICT (user_id) WHERE user_id IS NOT NULL
         DO UPDATE SET ${updates}, updated_at = now()`,
        [scope.uid, ...vals]
      );
    } else {
      await pgPool.query(
        `INSERT INTO user_settings (anon_id, ${cols.join(", ")}) VALUES ($1, ${placeholders})
         ON CONFLICT (anon_id) WHERE user_id IS NULL AND anon_id IS NOT NULL
         DO UPDATE SET ${updates}, updated_at = now()`,
        [scope.anonId, ...vals]
      );
    }

    const { row } = await loadProfile();
    return NextResponse.json(toView(row));
  } catch (e) {
    return dbErrorResponse(e);
  }
}
