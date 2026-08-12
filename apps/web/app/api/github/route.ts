import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  const { rows } = await pgPool.query(
    `SELECT id, title, url, content FROM resume_assets
     WHERE kind = 'github' AND user_id IS NOT DISTINCT FROM $1 ORDER BY id DESC`,
    [uid]
  );
  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const url = typeof body?.url === "string" ? body.url.trim() : null;
  const content = typeof body?.content === "string" ? body.content.trim() : null;
  if (!title) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  const { rows } = await pgPool.query(
    `INSERT INTO resume_assets (user_id, kind, title, url, content) VALUES ($1, 'github', $2, $3, $4)
     RETURNING id, title, url, content`,
    [uid, title, url, content]
  );
  return NextResponse.json({ record: rows[0] }, { status: 201 });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  await pgPool.query(
    `DELETE FROM resume_assets WHERE id = $1 AND kind = 'github' AND user_id IS NOT DISTINCT FROM $2`,
    [id, uid]
  );
  return NextResponse.json({ ok: true });
}
