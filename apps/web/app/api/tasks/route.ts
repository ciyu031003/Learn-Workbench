import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { todayISO } from "@learn-workbench/shared";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order
     FROM daily_tasks WHERE user_id IS NOT DISTINCT FROM $1 AND task_date = $2 ORDER BY sort_order, id`,
    [uid, date]
  );
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const taskDate = String(body?.taskDate || todayISO());
  const title = String(body?.title || "").trim();
  const taskType = String(body?.taskType || "study");
  const phaseIdRaw = body?.phaseId;
  const phaseId = phaseIdRaw === null || phaseIdRaw === undefined || phaseIdRaw === "" ? null : Number(phaseIdRaw);
  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `INSERT INTO daily_tasks (user_id, task_date, title, task_type, phase_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order`,
    [uid, taskDate, title, taskType, phaseId]
  );
  return NextResponse.json({ task: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const uid = await currentUserId();
  const sets: string[] = [];
  const params: (string | number | boolean)[] = [];
  if (typeof body?.done === "boolean") {
    params.push(body.done);
    sets.push(`done = $${params.length}`);
  }
  if (sets.length === 0) return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  params.push(id);
  const { rows } = await pgPool.query(
    `UPDATE daily_tasks SET ${sets.join(", ")} WHERE id = $${params.length} AND user_id IS NOT DISTINCT FROM $${params.length + 1}
     RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order`,
    [...params, uid]
  );
  return NextResponse.json({ task: rows[0] ?? null });
}
