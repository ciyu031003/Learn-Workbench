import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";
import { parseBody } from "@/lib/http";

export async function GET() {
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const params: unknown[] = [uid];
  let anonSql = "";
  if (!uid) {
    params.push(anonId);
    anonSql = ` AND ${anonFilterSql(params.length)}`;
  }
  const { rows } = await pgPool.query(
    `SELECT id, title, url, content FROM resume_assets
     WHERE kind = 'github' AND user_id IS NOT DISTINCT FROM $1${anonSql} ORDER BY id DESC`,
    params
  );
  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  const parsed = await parseBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const title = String(body.title ?? "").trim().slice(0, 200);
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : null;
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 20_000) : null;
  if (!title) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  if (uid) {
    const { rows } = await pgPool.query(
      `INSERT INTO resume_assets (user_id, kind, title, url, content) VALUES ($1, 'github', $2, $3, $4)
       RETURNING id, title, url, content`,
      [uid, title, url, content]
    );
    return NextResponse.json({ record: rows[0] }, { status: 201 });
  }
  const anonId = await getAnonId();
  const { rows } = await pgPool.query(
    `INSERT INTO resume_assets (user_id, anon_id, kind, title, url, content) VALUES (NULL, $1, 'github', $2, $3, $4)
     RETURNING id, title, url, content`,
    [anonId, title, url, content]
  );
  return NextResponse.json({ record: rows[0] }, { status: 201 });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const params: unknown[] = [id, uid];
  let scopeSql = `user_id IS NOT DISTINCT FROM $2`;
  if (!uid) {
    params.push(anonId);
    scopeSql += ` AND ${anonFilterSql(params.length)}`;
  }
  await pgPool.query(
    `DELETE FROM resume_assets WHERE id = $1 AND kind = 'github' AND ${scopeSql}`,
    params
  );
  return NextResponse.json({ ok: true });
}