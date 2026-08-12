import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { todayISO } from "@learn-workbench/shared";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const { rows } = await pgPool.query(
    `SELECT id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order
     FROM daily_tasks WHERE user_id IS NULL AND task_date = $1 ORDER BY sort_order, id`,
    [date]
  );
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const taskDate = String(body?.taskDate || todayISO());
  const title = String(body?.title || "").trim();
  const taskType = String(body?.taskType || "study");
  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const { rows } = await pgPool.query(
    `INSERT INTO daily_tasks (user_id, task_date, title, task_type)
     VALUES (NULL, $1, $2, $3) RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order`,
    [taskDate, title, taskType]
  );
  return NextResponse.json({ task: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const sets: string[] = [];
  const params: (string | number | boolean)[] = [];
  if (typeof body?.done === "boolean") {
    params.push(body.done);
    sets.push(`done = $${params.length}`);
  }
  if (sets.length === 0) return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  params.push(id);
  const { rows } = await pgPool.query(
    `UPDATE daily_tasks SET ${sets.join(", ")} WHERE id = $${params.length}
     RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order`,
    params
  );
  return NextResponse.json({ task: rows[0] ?? null });
}

