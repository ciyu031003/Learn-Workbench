import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

const KINDS = ["feynman", "review", "project", "interview"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, kind, title, content, created_at, updated_at
     FROM log_entries WHERE user_id IS NOT DISTINCT FROM $1 ORDER BY created_at DESC LIMIT $2`,
    [uid, limit]
  );
  return NextResponse.json({ logs: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || "");
  const title = String(body?.title || "").trim();
  const content = String(body?.content || "").trim();
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "kind 无效" }, { status: 400 });
  if (!title || !content) return NextResponse.json({ error: "标题与内容不能为空" }, { status: 400 });
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `INSERT INTO log_entries (user_id, kind, title, content) VALUES ($1, $2, $3, $4)
     RETURNING id, kind, title, content, created_at, updated_at`,
    [uid, kind, title, content]
  );
  return NextResponse.json({ log: rows[0] }, { status: 201 });
}
