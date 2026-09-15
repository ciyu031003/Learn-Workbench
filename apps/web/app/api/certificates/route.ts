import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api-error";
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";

const STATUSES = ["planned", "preparing", "achieved"] as const;
type Status = (typeof STATUSES)[number];

const SELECT_COLS = `id, name, target_date AS "targetDate", status, issuer,
  earned_date AS "earnedDate", expiry_date AS "expiryDate", image_url AS "imageUrl",
  sort_order AS "sortOrder", note, updated_at AS "updatedAt"`;

function pickStatus(raw: unknown): Status | null {
  return typeof raw === "string" && (STATUSES as readonly string[]).includes(raw) ? (raw as Status) : null;
}

/** 日期列：接受 'YYYY-MM-DD'，非法或空返回 null */
function pickDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function pickText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  return raw.trim().slice(0, max) || null;
}

/** 校验 POST body（返回 {ok, data|error}） */
function validateBody(body: Record<string, unknown>):
  | { ok: true; name: string; status: Status; targetDate: string | null; issuer: string | null; earnedDate: string | null; expiryDate: string | null; imageUrl: string | null; note: string | null; sortOrder: number }
  | { ok: false; error: string } {
  const name = String(body.name ?? "").trim().slice(0, 200);
  if (!name) return { ok: false, error: "证书名称不能为空" };
  if (body.status !== undefined && !pickStatus(body.status)) {
    return { ok: false, error: "status 无效（planned/preparing/achieved）" };
  }
  const status = pickStatus(body.status) ?? "planned";
  return {
    ok: true,
    name,
    status,
    targetDate: pickDate(body.targetDate),
    issuer: pickText(body.issuer, 200),
    earnedDate: pickDate(body.earnedDate),
    expiryDate: pickDate(body.expiryDate),
    imageUrl: pickText(body.imageUrl, 2000),
    note: pickText(body.note, 5000),
    sortOrder: Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0))),
  };
}

/** GET /api/certificates —— 当前作用域（登录/匿名）未删除的证书列表 */
export async function GET() {
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid]);
  const { rows } = await pgPool.query(
    `SELECT ${SELECT_COLS}
       FROM certificates
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND deleted_at IS NULL
      ORDER BY sort_order, COALESCE(expiry_date, target_date) NULLS LAST, id DESC`,
    w.params
  );
  return NextResponse.json({ records: rows });
}

/** POST /api/certificates —— 新建证书 */
export async function POST(req: Request) {
  try {
  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const v = validateBody(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const clientId = pickText(body.clientId, 200);
  const scope = await userScope();
  const cols = `name, target_date, status, issuer, earned_date, expiry_date, image_url, sort_order, note, client_id`;
  const vals = [v.name, v.targetDate, v.status, v.issuer, v.earnedDate, v.expiryDate, v.imageUrl, v.sortOrder, v.note, clientId];

  let rows;
  if (scope.uid) {
    ({ rows } = await pgPool.query(
      `INSERT INTO certificates (user_id, ${cols}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SELECT_COLS}`,
      [scope.uid, ...vals]
    ));
  } else {
    ({ rows } = await pgPool.query(
      `INSERT INTO certificates (user_id, anon_id, ${cols}) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SELECT_COLS}`,
      [scope.anonId, ...vals]
    ));
  }
  return NextResponse.json({ record: rows[0] }, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

/** PATCH /api/certificates —— 局部更新（id 必填） */
export async function PATCH(req: Request) {
  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  const sets: string[] = [];
  const params: unknown[] = [...w.params];
  const set = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: "证书名称不能为空" }, { status: 400 });
    set("name", name);
  }
  if (body.status !== undefined) {
    const st = pickStatus(body.status);
    if (!st) return NextResponse.json({ error: "status 无效" }, { status: 400 });
    set("status", st);
  }
  if (body.targetDate !== undefined) set("target_date", pickDate(body.targetDate));
  if (body.issuer !== undefined) set("issuer", pickText(body.issuer, 200));
  if (body.earnedDate !== undefined) set("earned_date", pickDate(body.earnedDate));
  if (body.expiryDate !== undefined) set("expiry_date", pickDate(body.expiryDate));
  if (body.imageUrl !== undefined) set("image_url", pickText(body.imageUrl, 2000));
  if (body.note !== undefined) set("note", pickText(body.note, 5000));
  if (body.sortOrder !== undefined) set("sort_order", Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0))));

  if (sets.length === 0) return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });

  const { rows } = await pgPool.query(
    `UPDATE certificates SET ${sets.join(", ")}, updated_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2 AND deleted_at IS NULL
      RETURNING ${SELECT_COLS}`,
    params
  );
  if (!rows[0]) return NextResponse.json({ error: "未找到记录" }, { status: 404 });
  return NextResponse.json({ record: rows[0] });
}

/** DELETE /api/certificates?id= —— 软删除 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const scope = await userScope();
  const w = scopeWhere(scope, [scope.uid, id]);
  await pgPool.query(
    `UPDATE certificates SET deleted_at = now()
      WHERE user_id IS NOT DISTINCT FROM $1${w.sql} AND id = $2`,
    w.params
  );
  return NextResponse.json({ ok: true });
}
