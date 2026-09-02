import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";

/** 读取阶段归属（含领域 owner），校验：他人自定义域/阶段一律 403 */
async function loadPhaseScope(phaseId: number, uid: string): Promise<{ owner_id: string | null } | NextResponse> {
  const { rows } = await pgPool.query<{ owner_id: string | null }>(
    `SELECT p.owner_id
     FROM content_phases p
     LEFT JOIN careers c ON c.career_key = p.career_key
     WHERE p.id = $1`,
    [phaseId]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "阶段不存在" }, { status: 400 });
  const phaseOwner = row.owner_id ?? null;
  if (phaseOwner !== null && phaseOwner !== uid) {
    return NextResponse.json({ error: "无权操作他人自定义阶段" }, { status: 403 });
  }
  return { owner_id: row.owner_id };
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const phaseId = Number(body?.phaseId);
  const title = String(body?.title ?? "").trim();
  const summary = typeof body?.summary === "string" ? body.summary.trim() : null;
  if (!Number.isFinite(phaseId) || !title) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const scopeOrErr = await loadPhaseScope(phaseId, uid);
  if (scopeOrErr instanceof NextResponse) return scopeOrErr;

  const { rows } = await pgPool.query(
    `INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order, is_custom, owner_id)
     VALUES ($1, 'custom-' || gen_random_uuid(), $2, $3,
             (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM content_topics WHERE phase_id = $1), TRUE, $4)
     RETURNING id, phase_id, title, summary, is_custom`,
    [phaseId, title, summary, uid]
  );
  return NextResponse.json({ topic: rows[0] }, { status: 201 });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const topicId = Number(url.searchParams.get("topicId"));
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: "topicId 无效" }, { status: 400 });
  await pgPool.query(
    `DELETE FROM content_topics WHERE id = $1 AND is_custom = TRUE AND owner_id = $2`,
    [topicId, uid]
  );
  return NextResponse.json({ ok: true });
}
