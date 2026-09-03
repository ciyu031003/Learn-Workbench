import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId, anonFilterSql } from "@/lib/anon";

/** 领域记录项（计量模型）：GET 按领域列出；POST 新建；PATCH 改目标/单位；DELETE 软删除（级联记录由服务端删除） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const career = url.searchParams.get("career") || "ict";
  const uid = await currentUserId();
  const anonId = uid ? null : await getAnonId();
  const params: unknown[] = [uid, career];
  let anonSql = "";
  if (!uid) {
    anonSql = ` AND ${anonFilterSql(params.length + 1)}`;
    params.push(anonId);
  }
  const { rows } = await pgPool.query(
    `SELECT id, domain_key, name, unit, target_value, target_cadence, color
     FROM domain_trackers
     WHERE user_id IS NOT DISTINCT FROM $1 AND domain_key = $2 AND deleted_at IS NULL${anonSql}
     ORDER BY id`,
    params
  );
  return NextResponse.json({ trackers: rows });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const domainKey = String(body?.career || body?.domainKey || "ict").trim();
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "记录项名称不能为空" }, { status: 400 });
  const unit = String(body?.unit || "").trim();
  const targetValue = body?.targetValue === null || body?.targetValue === undefined || body?.targetValue === "" ? null : Number(body.targetValue);
  const targetCadence = body?.targetCadence === "weekly" ? "weekly" : body?.targetCadence === "daily" ? "daily" : null;
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body?.color || "")) ? String(body.color).toLowerCase() : "#6366f1";
  const { rows } = await pgPool.query(
    `INSERT INTO domain_trackers (user_id, domain_key, name, unit, target_value, target_cadence, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, domain_key, name) DO UPDATE SET
       unit = EXCLUDED.unit, target_value = EXCLUDED.target_value,
       target_cadence = EXCLUDED.target_cadence, color = EXCLUDED.color,
       deleted_at = NULL, updated_at = now()
     RETURNING id, domain_key, name, unit, target_value, target_cadence, color`,
    [uid, domainKey, name, unit, targetValue, targetCadence, color]
  );
  return NextResponse.json({ tracker: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body?.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "记录项名称不能为空" }, { status: 400 });
    params.push(name);
    sets.push(`name = $${params.length}`);
  }
  if (body?.unit !== undefined) {
    params.push(String(body.unit || "").trim());
    sets.push(`unit = $${params.length}`);
  }
  if (body?.targetValue !== undefined) {
    params.push(body.targetValue === null || body.targetValue === "" ? null : Number(body.targetValue));
    sets.push(`target_value = $${params.length}`);
  }
  if (body?.targetCadence !== undefined) {
    const c = body.targetCadence === "weekly" ? "weekly" : body.targetCadence === "daily" ? "daily" : null;
    params.push(c);
    sets.push(`target_cadence = $${params.length}`);
  }
  if (body?.color !== undefined) {
    params.push(/^#[0-9a-fA-F]{6}$/.test(String(body.color)) ? String(body.color).toLowerCase() : "#6366f1");
    sets.push(`color = $${params.length}`);
  }
  if (sets.length === 0) return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  params.push(id);
  const { rows } = await pgPool.query(
    `UPDATE domain_trackers SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${params.length} AND user_id = $1 AND deleted_at IS NULL
     RETURNING id, domain_key, name, unit, target_value, target_cadence, color`,
    [uid, ...params]
  );
  if (!rows[0]) return NextResponse.json({ error: "记录项不存在" }, { status: 404 });
  return NextResponse.json({ tracker: rows[0] });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<{ id: number }>(
      `SELECT id FROM domain_trackers WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, uid]
    );
    if (!owned.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "记录项不存在" }, { status: 404 });
    }
    await client.query(`DELETE FROM tracker_logs WHERE tracker_id = $1`, [id]);
    await client.query(`DELETE FROM domain_trackers WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
