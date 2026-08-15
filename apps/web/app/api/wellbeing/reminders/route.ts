import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { computeNextTriggerMs } from "@/lib/wellbeing";

const TYPES = ["HYDRATION", "STAND", "BREAK", "MOVEMENT", "SLEEP", "CUSTOM"];

function cleanWeekdays(v: unknown): number[] {
  if (!Array.isArray(v)) return [1, 2, 3, 4, 5, 6, 7];
  const days = v.map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  return days.length ? [...new Set(days)] : [1, 2, 3, 4, 5, 6, 7];
}

function cleanTime(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return /^\d{2}:\d{2}$/.test(v) ? v : fallback;
}

export async function GET() {
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, type, title, message, enabled, interval_minutes AS "intervalMinutes",
            start_time AS "startTime", end_time AS "endTime", weekdays,
            next_trigger_at AS "nextTriggerAt"
     FROM wellbeing_reminders
     WHERE user_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL
     ORDER BY created_at`,
    [uid]
  );
  return NextResponse.json({ reminders: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const type = TYPES.includes(body?.type) ? String(body.type) : "CUSTOM";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "提醒标题不能为空" }, { status: 400 });
  const intervalMinutes = Math.min(1440, Math.max(1, Number(body?.intervalMinutes) || 60));
  const startTime = cleanTime(body?.startTime, "09:00");
  const endTime = cleanTime(body?.endTime, "22:00");
  const weekdays = cleanWeekdays(body?.weekdays);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 200) || null : null;
  const nextTriggerAt = new Date(
    computeNextTriggerMs({ intervalMinutes, startTime, endTime, weekdays })
  ).toISOString();
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `INSERT INTO wellbeing_reminders (user_id, type, title, message, interval_minutes, start_time, end_time, weekdays, next_trigger_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, type, title, message, enabled, interval_minutes AS "intervalMinutes",
               start_time AS "startTime", end_time AS "endTime", weekdays, next_trigger_at AS "nextTriggerAt"`,
    [uid, type, title, message, intervalMinutes, startTime, endTime, weekdays, nextTriggerAt]
  );
  return NextResponse.json({ reminder: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const uid = await currentUserId();
  const sets: string[] = [];
  const params: (string | number | boolean | number[] | null)[] = [];
  if (typeof body?.enabled === "boolean") {
    params.push(body.enabled);
    sets.push(`enabled = $${params.length}`);
  }
  if (typeof body?.title === "string" && body.title.trim()) {
    params.push(body.title.trim());
    sets.push(`title = $${params.length}`);
  }
  if (typeof body?.intervalMinutes === "number") {
    params.push(Math.min(1440, Math.max(1, body.intervalMinutes)));
    sets.push(`interval_minutes = $${params.length}`);
  }
  if (typeof body?.startTime === "string") {
    params.push(cleanTime(body.startTime, "09:00"));
    sets.push(`start_time = $${params.length}`);
  }
  if (typeof body?.endTime === "string") {
    params.push(cleanTime(body.endTime, "22:00"));
    sets.push(`end_time = $${params.length}`);
  }
  if (sets.length === 0) return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  // 重新计算 next_trigger_at
  const cur = await pgPool.query(
    `SELECT interval_minutes AS "intervalMinutes", start_time AS "startTime", end_time AS "endTime", weekdays
     FROM wellbeing_reminders WHERE id = $1 AND user_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL`,
    [id, uid]
  );
  if (cur.rows[0]) {
    const r = cur.rows[0];
    const intervalMinutes = Number(body?.intervalMinutes) || r.intervalMinutes;
    const startTime = cleanTime(body?.startTime, r.startTime);
    const endTime = cleanTime(body?.endTime, r.endTime);
    const weekdays = cleanWeekdays(body?.weekdays ?? r.weekdays);
    params.push(new Date(computeNextTriggerMs({ intervalMinutes, startTime, endTime, weekdays })).toISOString());
    sets.push(`next_trigger_at = $${params.length}`);
    sets.push(`updated_at = now()`);
  }
  params.push(id);
  params.push(uid);
  const { rows } = await pgPool.query(
    `UPDATE wellbeing_reminders SET ${sets.join(", ")}
     WHERE id = $${params.length - 1} AND user_id IS NOT DISTINCT FROM $${params.length} AND deleted_at IS NULL
     RETURNING id, type, title, message, enabled, interval_minutes AS "intervalMinutes",
               start_time AS "startTime", end_time AS "endTime", weekdays, next_trigger_at AS "nextTriggerAt"`,
    params
  );
  return NextResponse.json({ reminder: rows[0] ?? null });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const uid = await currentUserId();
  await pgPool.query(
    `UPDATE wellbeing_reminders SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id IS NOT DISTINCT FROM $2`,
    [id, uid]
  );
  return NextResponse.json({ ok: true });
}
