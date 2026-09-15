import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { workoutVolume, type WorkoutItem } from "@learn-workbench/shared";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ItemInput {
  exerciseKey: string | null;
  exerciseLabel: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  durationSeconds: number;
  sortOrder: number;
}

/** 归一化动作列表（过滤空标签，钳位数值） */
export function normalizeItems(raw: unknown): ItemInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ItemInput[] = [];
  raw.forEach((r, i) => {
    if (typeof r !== "object" || r === null) return;
    const o = r as Record<string, unknown>;
    const label = String(o.exerciseLabel ?? "").trim().slice(0, 80);
    if (!label) return;
    const weightRaw = Number(o.weightKg);
    out.push({
      exerciseKey: typeof o.exerciseKey === "string" ? o.exerciseKey.trim().slice(0, 60) || null : null,
      exerciseLabel: label,
      sets: Math.max(0, Math.min(200, Math.round(Number(o.sets) || 1))),
      reps: Math.max(0, Math.min(2000, Math.round(Number(o.reps) || 1))),
      weightKg: Number.isFinite(weightRaw) && weightRaw >= 0 ? Math.min(2000, Math.round(weightRaw * 10) / 10) : null,
      durationSeconds: Math.max(0, Math.min(86400, Math.round(Number(o.durationSeconds) || 0))),
      sortOrder: Number.isFinite(Number(o.sortOrder)) ? Math.round(Number(o.sortOrder)) : i,
    });
  });
  return out;
}

/** GET /api/workouts?days=30 —— 训练记录（含动作明细） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(365, Math.round(daysRaw)) : 30;

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, days]);
  const { rows } = await pgPool.query<{
    id: string; name: string; exercisedOn: string; durationSeconds: number;
    note: string | null; updatedAt: string;
  }>(
    `SELECT id, name, exercised_on AS "exercisedOn", duration_seconds AS "durationSeconds",
            note, updated_at AS "updatedAt"
       FROM workouts
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql}
        AND deleted_at IS NULL
        AND exercised_on >= CURRENT_DATE - ($2::int || ' days')::interval
      ORDER BY exercised_on DESC, id DESC`,
    w.params
  );
  if (rows.length === 0) return NextResponse.json({ workouts: [], totals: { sets: 0, reps: 0, volumeKg: 0 } });

  const ids = rows.map((r) => Number(r.id));
  const w2 = scopeWhere(scope, [scope.uid, ids]);
  const { rows: itemRows } = await pgPool.query<{
    id: string; workoutId: string; exerciseKey: string | null; exerciseLabel: string;
    sets: number; reps: number; weightKg: string | null; durationSeconds: number; sortOrder: number;
  }>(
    `SELECT id, workout_id AS "workoutId", exercise_key AS "exerciseKey", exercise_label AS "exerciseLabel",
            sets, reps, weight_kg AS "weightKg", duration_seconds AS "durationSeconds", sort_order AS "sortOrder"
       FROM workout_items
      WHERE user_id IS NOT DISTINCT FROM $1 AND workout_id = ANY($2::bigint[])${w2.sql}
      ORDER BY sort_order, id`,
    w2.params
  );

  const byWorkout = new Map<string, WorkoutItem[]>();
  for (const it of itemRows) {
    const key = String(it.workoutId);
    const list = byWorkout.get(key) ?? [];
    list.push({
      id: Number(it.id),
      exerciseKey: it.exerciseKey,
      exerciseLabel: it.exerciseLabel,
      sets: Number(it.sets),
      reps: Number(it.reps),
      weightKg: it.weightKg === null ? null : Number(it.weightKg),
      durationSeconds: Number(it.durationSeconds),
      sortOrder: Number(it.sortOrder),
    });
    byWorkout.set(key, list);
  }

  const workouts = rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    exercisedOn: String(r.exercisedOn).slice(0, 10),
    durationSeconds: Number(r.durationSeconds),
    note: r.note,
    updatedAt: r.updatedAt,
    items: byWorkout.get(String(r.id)) ?? [],
  }));

  const allItems = workouts.flatMap((x) => x.items);
  return NextResponse.json({ workouts, totals: workoutVolume(allItems) });
}

/** POST /api/workouts —— 新建训练（含动作明细） */
export async function POST(req: Request) {
  try {
  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const name = String(body.name ?? "").trim().slice(0, 60) || "训练";
  const dateRaw = typeof body.exercisedOn === "string" ? body.exercisedOn.slice(0, 10) : "";
  const exercisedOn = DATE_RE.test(dateRaw)
    ? dateRaw
    : (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
  const durationSeconds = Math.max(0, Math.min(86400, Math.round(Number(body.durationSeconds) || 0)));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;
  const clientId = typeof body.clientId === "string" ? body.clientId.trim().slice(0, 200) || null : null;
  const items = normalizeItems(body.items);

  const scope = await userScope();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = scope.uid
      ? await client.query(
          `INSERT INTO workouts (user_id, name, exercised_on, duration_seconds, note, client_id)
           VALUES ($1,$2,$3::date,$4,$5,$6) RETURNING id`,
          [scope.uid, name, exercisedOn, durationSeconds, note, clientId]
        )
      : await client.query(
          `INSERT INTO workouts (user_id, anon_id, name, exercised_on, duration_seconds, note, client_id)
           VALUES (NULL,$1,$2,$3::date,$4,$5,$6) RETURNING id`,
          [scope.anonId, name, exercisedOn, durationSeconds, note, clientId]
        );
    const workoutId = Number(rows[0].id);
    for (const it of items) {
      await client.query(
        `INSERT INTO workout_items
           (user_id, workout_id, exercise_key, exercise_label, sets, reps, weight_kg, duration_seconds, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [scope.uid, workoutId, it.exerciseKey, it.exerciseLabel, it.sets, it.reps, it.weightKg, it.durationSeconds, it.sortOrder]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ workout: { id: workoutId, name, exercisedOn, durationSeconds, note, items } }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  } catch (e) {
    return dbErrorResponse(e);
  }
}