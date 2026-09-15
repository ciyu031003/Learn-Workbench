import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { listHabitsWithStats } from "@/lib/habits";
import { normalizeHabitTime } from "@learn-workbench/shared";

/** GET /api/habits —— 习惯 + 统计 + 近 90 天打卡 */
export async function GET() {
  const scope = await userScope();
  const data = await listHabitsWithStats(scope);
  return NextResponse.json(data);
}

/** 归一化 schedule：接受 [0..6] 数组，空/非法回退每天 */
function pickSchedule(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [0, 1, 2, 3, 4, 5, 6];
  const set = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  const out = [...set].sort((a, b) => a - b);
  return out.length > 0 ? out : [0, 1, 2, 3, 4, 5, 6];
}

/** POST /api/habits —— 新建习惯 */
export async function POST(req: Request) {
  try {
  const parsed = await parseBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "习惯名称不能为空" }, { status: 400 });

  const isBoolean = body.isBoolean === undefined ? true : Boolean(body.isBoolean);
  const rawTarget = Number(body.targetValue);
  const targetValue = isBoolean || !Number.isFinite(rawTarget) || rawTarget <= 0
    ? null
    : Math.min(1_000_000, Math.round(rawTarget * 100) / 100);
  const unit = typeof body.unit === "string" ? body.unit.trim().slice(0, 20) || null : null;
  const icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 20) || null : null;
  const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : "#6366f1";
  const schedule = pickSchedule(body.schedule);
  const sortOrder = Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0)));
  const clientId = typeof body.clientId === "string" ? body.clientId.trim().slice(0, 200) || null : null;
  // 可选时间段（迁移 043）：非法/空 → null
  const remindStart = normalizeHabitTime(body.remindStart);
  const remindEnd = normalizeHabitTime(body.remindEnd);

  const scope = await userScope();
  const cols = `name, icon, is_boolean, target_value, unit, schedule, color, sort_order, remind_start, remind_end, client_id`;
  const vals = [name, icon, isBoolean, targetValue, unit, schedule, color, sortOrder, remindStart, remindEnd, clientId];

  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO habits (user_id, ${cols}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, name, icon, is_boolean AS "isBoolean", target_value AS "targetValue",
                 unit, schedule, color, sort_order AS "sortOrder",
                 remind_start AS "remindStart", remind_end AS "remindEnd"`,
      [scope.uid, ...vals]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO habits (user_id, anon_id, ${cols}) VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, name, icon, is_boolean AS "isBoolean", target_value AS "targetValue",
                 unit, schedule, color, sort_order AS "sortOrder",
                 remind_start AS "remindStart", remind_end AS "remindEnd"`,
      [scope.anonId, ...vals]
    ));
  }
  return NextResponse.json({ habit: rows[0] }, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}