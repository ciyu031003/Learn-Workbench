import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

const KINDS = ["feynman", "review", "project", "interview"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
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
  const params: unknown[] = [uid, career, limit];
  let anonSql = "";
  if (!uid) {
    anonSql = ` AND ${anonFilterSql(params.length + 1)}`;
    params.push(anonId);
  }
  const { rows } = await pgPool.query(
    `SELECT id, kind, career_key, title, content, created_at, updated_at
     FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1${anonSql} AND career_key = $2 ORDER BY created_at DESC LIMIT $3`,
    params
  );
  return NextResponse.json({ logs: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || "");
  const career = String(body?.career || "ict");
  const title = String(body?.title || "").trim();
  const content = String(body?.content || "").trim();
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "kind 无效" }, { status: 400 });
  if (!title || !content) return NextResponse.json({ error: "标题与内容不能为空" }, { status: 400 });
  const uid = await currentUserId();
  if (uid) {
    const { rows } = await pgPool.query(
      `INSERT INTO log_entries (user_id, kind, career_key, title, content) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, kind, career_key, title, content, created_at, updated_at`,
      [uid, kind, career, title, content]
    );
    return NextResponse.json({ log: rows[0] }, { status: 201 });
  }
  const anonId = await getAnonId();
  const { rows } = await pgPool.query(
    `INSERT INTO log_entries (user_id, anon_id, kind, career_key, title, content) VALUES (NULL, $1, $2, $3, $4, $5)
     RETURNING id, kind, career_key, title, content, created_at, updated_at`,
    [anonId, kind, career, title, content]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}