import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";
import { todayISO } from "@learn-workbench/shared";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISO();
  const careerParam = url.searchParams.get("career");
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  // 领域维度：显式 career 参数优先，否则跟随用户设置（匿名默认 ICT）
  let career = "ict";
  if (careerParam) {
    career = careerParam;
  } else if (uid) {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = $2`,
      [uid, "career"]
    );
    if (rows[0]?.value) career = String(rows[0].value);
  }
  const params: unknown[] = [uid, date, career];
  let anonSql = "";
  if (!uid) {
    anonSql = ` AND ${anonFilterSql(4)}`;
    params.push(anonId);
  }
  const { rows } = await pgPool.query(
    `SELECT id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order, career_key
     FROM daily_tasks WHERE user_id IS NOT DISTINCT FROM $1 AND task_date = $2 AND career_key = $3${anonSql} ORDER BY sort_order, id`,
    params
  );
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const taskDate = String(body?.taskDate || todayISO());
  const title = String(body?.title || "").trim();
  const taskType = String(body?.taskType || "study");
  const career = String(body?.career || "ict");
  const phaseIdRaw = body?.phaseId;
  const phaseId = phaseIdRaw === null || phaseIdRaw === undefined || phaseIdRaw === "" ? null : Number(phaseIdRaw);
  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const uid = await currentUserId();
  if (uid) {
    const { rows } = await pgPool.query(
      `INSERT INTO daily_tasks (user_id, task_date, title, task_type, phase_id, career_key)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order, career_key`,
      [uid, taskDate, title, taskType, phaseId, career]
    );
    return NextResponse.json({ task: rows[0] }, { status: 201 });
  }
  const anonId = await getAnonId();
  const { rows } = await pgPool.query(
    `INSERT INTO daily_tasks (user_id, anon_id, task_date, title, task_type, phase_id, career_key)
     VALUES (NULL, $1, $2, $3, $4, $5, $6) RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order, career_key`,
    [anonId, taskDate, title, taskType, phaseId, career]
  );
  return NextResponse.json({ task: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof body?.done === "boolean") {
    params.push(body.done);
    sets.push(`done = $${params.length}`);
  }
  if (sets.length === 0) return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  params.push(id);
  const scopeParams: unknown[] = [uid];
  let scopeSql = `user_id IS NOT DISTINCT FROM $${params.length + 1}`;
  if (!uid) {
    scopeParams.push(anonId);
    scopeSql += ` AND ${anonFilterSql(params.length + 2)}`;
  }
  const { rows } = await pgPool.query(
    `UPDATE daily_tasks SET ${sets.join(", ")} WHERE id = $${params.length} AND ${scopeSql}
     RETURNING id, task_date, title, phase_id, topic_id, task_type, done, focus_minutes, sort_order, career_key`,
    [...params, ...scopeParams]
  );
  return NextResponse.json({ task: rows[0] ?? null });
}