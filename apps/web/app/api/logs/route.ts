import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";

const KINDS = ["feynman", "review", "project", "interview"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const { rows } = await pgPool.query(
    `SELECT id, kind, title, content, created_at, updated_at
     FROM log_entries WHERE user_id IS NULL ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return NextResponse.json({ logs: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const kind = String(body?.kind || "");
  const title = String(body?.title || "").trim();
  const content = String(body?.content || "").trim();
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "kind 无效" }, { status: 400 });
  if (!title || !content) return NextResponse.json({ error: "标题与内容不能为空" }, { status: 400 });
  const { rows } = await pgPool.query(
    `INSERT INTO log_entries (user_id, kind, title, content) VALUES (NULL, $1, $2, $3)
     RETURNING id, kind, title, content, created_at, updated_at`,
    [kind, title, content]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}
