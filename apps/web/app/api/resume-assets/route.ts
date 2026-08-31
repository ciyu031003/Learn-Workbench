import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { resumeAssetKindSchema } from "@learn-workbench/shared";


const SELECT_COLS = `id, kind, title, content, url, sort_order AS "sortOrder", updated_at AS "updatedAt"`;

function pickKind(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return resumeAssetKindSchema.safeParse(raw).success ? raw : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("kind");
  const scope = await userScope();
  const base: unknown[] = [scope.uid];
  const w = scopeWhere(scope, base);
  let kindSql = "";
  const params = [...w.params];
  const kind = pickKind(kindRaw);
  if (kind) {
    params.push(kind);
    kindSql = ` AND kind = $${params.length}`;
  }
  const { rows } = await pgPool.query(
    `SELECT ${SELECT_COLS}
     FROM resume_assets
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql}${kindSql} AND deleted_at IS NULL
     ORDER BY kind, sort_order, id DESC`,
    params
  );
  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const kind = pickKind(body.kind);
  if (!kind) return NextResponse.json({ error: "kind 无效（project/skill/github/certificate）" }, { status: 400 });
  const title = String(body.title ?? "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 20_000) || null : null;
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) || null : null;
  const sortOrder = Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0)));

  const scope = await userScope();
  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO resume_assets (user_id, kind, title, content, url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLS}`,
      [scope.uid, kind, title, content, url, sortOrder]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO resume_assets (user_id, anon_id, kind, title, content, url, sort_order)
       VALUES (NULL, $1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLS}`,
      [scope.anonId, kind, title, content, url, sortOrder]
    ));
  }
  return NextResponse.json({ record: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const kind = pickKind(body.kind);
  if (body.kind !== undefined && !kind) {
    return NextResponse.json({ error: "kind 无效" }, { status: 400 });
  }
  const title = body.title !== undefined ? String(body.title).trim().slice(0, 200) : undefined;
  if (title !== undefined && !title) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  const content = body.content !== undefined ? (typeof body.content === "string" ? body.content.trim().slice(0, 20_000) || null : null) : undefined;
  const url = body.url !== undefined ? (typeof body.url === "string" ? body.url.trim().slice(0, 2000) || null : null) : undefined;
  const sortOrder = body.sortOrder !== undefined ? Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0))) : undefined;

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  const sets: string[] = [];
  const params: unknown[] = [...w.params];
  if (kind) { params.push(kind); sets.push(`kind = $${params.length}`); }
  if (title !== undefined) { params.push(title); sets.push(`title = $${params.length}`); }
  if (content !== undefined) { params.push(content); sets.push(`content = $${params.length}`); }
  if (url !== undefined) { params.push(url); sets.push(`url = $${params.length}`); }
  if (sortOrder !== undefined) { params.push(sortOrder); sets.push(`sort_order = $${params.length}`); }
  if (sets.length === 0) return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });

  const { rows } = await pgPool.query(
    `UPDATE resume_assets SET ${sets.join(", ")}, updated_at = now()
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL
     RETURNING ${SELECT_COLS}`,
    params
  );
  if (!rows[0]) return NextResponse.json({ error: "未找到记录" }, { status: 404 });
  return NextResponse.json({ record: rows[0] });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE resume_assets SET deleted_at = now()
     WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2`,
    w.params
  );
  return NextResponse.json({ ok: true });
}
