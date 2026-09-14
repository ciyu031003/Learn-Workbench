import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { listLogs } from "@/lib/habits";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/habits/logs?from=&to= —— 区间打卡记录 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? "";
  const from = url.searchParams.get("from") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "from/to 需为 YYYY-MM-DD" }, { status: 400 });
  }
  const scope = await userScope();
  const logs = await listLogs(scope, from, to);
  return NextResponse.json({ logs });
}

/**
 * POST /api/habits/logs —— One-Tap 打卡（按 user+habit+date upsert）
 * body: { habitId, date?: 'YYYY-MM-DD', value?: number, note? }
 * value 缺省为 1（布尔型打卡）；同一习惯同一天重复提交覆盖。
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, 64 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const habitId = Number(body.habitId);
  if (!Number.isInteger(habitId) || habitId <= 0) {
    return NextResponse.json({ error: "habitId 无效" }, { status: 400 });
  }
  const dateRaw = typeof body.date === "string" ? body.date.slice(0, 10) : "";
  const date = DATE_RE.test(dateRaw)
    ? dateRaw
    : (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
  const valueRaw = Number(body.value);
  const value = Number.isFinite(valueRaw) && valueRaw >= 0 ? Math.min(1_000_000, Math.round(valueRaw * 100) / 100) : 1;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const scope = await userScope();
  // 归属校验：习惯必须属于当前作用域
  const w = scopeWhere(scope, [scope.uid, habitId]);
  const { rows: own } = await pgPool.query(
    `SELECT id FROM habits WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL`,
    w.params
  );
  if (!own[0]) return NextResponse.json({ error: "未找到习惯" }, { status: 404 });

  const uid = scope.uid;
  const { rows } = await pgPool.query(
    `INSERT INTO habit_logs (user_id, habit_id, log_date, value, note)
     VALUES ($1, $2, $3::date, $4, $5)
     ON CONFLICT (user_id, habit_id, log_date)
     DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note, updated_at = now()
     RETURNING habit_id AS "habitId", log_date AS "logDate", value, note`,
    [uid, habitId, date, value, note]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}

/** DELETE /api/habits/logs?habitId=&date= —— 取消打卡 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const habitId = Number(url.searchParams.get("habitId"));
  const date = (url.searchParams.get("date") ?? "").slice(0, 10);
  if (!Number.isInteger(habitId) || habitId <= 0) {
    return NextResponse.json({ error: "habitId 无效" }, { status: 400 });
  }
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "date 需为 YYYY-MM-DD" }, { status: 400 });

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, habitId, date]);
  await pgPool.query(
    `DELETE FROM habit_logs
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND habit_id = $2 AND log_date = $3::date`,
    w.params
  );
  return NextResponse.json({ ok: true });
}