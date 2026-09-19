import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { normalizePairs, normalizeRecord, normalizeSignatureMove } from "../route";

const SELECT_COLS = `id, sport_key AS "sportKey", identity, level_text AS "levelText",
  handedness, play_style AS "playStyle", photo_url AS "photoUrl", gear, highlights,
  matches_played AS "matchesPlayed", wins, losses, signature_move AS "signatureMove",
  is_public AS "isPublic", share_slug AS "shareSlug", updated_at AS "updatedAt"`;

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** PATCH /api/sports/profiles/[id] —— 更新档案（含战绩/绝技/公开开关） */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });

  const token = await currentSessionToken();
  const userId = token ? await currentUserId() : null;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const sets: string[] = [];
  const params: unknown[] = [userId, id];
  const push = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };

  if (body.identity !== undefined) push("identity", typeof body.identity === "string" ? body.identity.trim().slice(0, 40) || null : null);
  if (body.levelText !== undefined) push("level_text", typeof body.levelText === "string" ? body.levelText.trim().slice(0, 40) || null : null);
  if (body.handedness !== undefined) push("handedness", body.handedness === null ? null : String(body.handedness));
  if (body.playStyle !== undefined) push("play_style", typeof body.playStyle === "string" ? body.playStyle.trim().slice(0, 40) || null : null);
  if (body.photoUrl !== undefined) push("photo_url", typeof body.photoUrl === "string" ? body.photoUrl.trim().slice(0, 2000) || null : null);
  if (body.gear !== undefined) push("gear", JSON.stringify(normalizePairs(body.gear)));
  if (body.highlights !== undefined) push("highlights", JSON.stringify(normalizePairs(body.highlights)));
  if (body.matchesPlayed !== undefined || body.wins !== undefined || body.losses !== undefined) {
    const record = normalizeRecord(body);
    push("matches_played", record.matches);
    push("wins", record.wins);
    push("losses", record.losses);
  }
  if (body.signatureMove !== undefined) push("signature_move", normalizeSignatureMove(body.signatureMove));
  if (body.isPublic !== undefined) {
    const pub = Boolean(body.isPublic);
    push("is_public", pub);
    if (pub) {
      // 保留已有分享短链，仅在缺失时补发
      params.push(`sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
      sets.push(`share_slug = COALESCE(share_slug, $${params.length})`);
    } else {
      sets.push("share_slug = NULL");
    }
  }

  if (sets.length === 0) return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });

  const { rows } = await pgPool.query(
    `UPDATE sports_profiles SET ${sets.join(", ")}, updated_at = now()
      WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING ${SELECT_COLS}`,
    params
  );
  if (!rows[0]) return NextResponse.json({ error: "未找到档案" }, { status: 404 });
  return NextResponse.json({ profile: rows[0] });
}

/** DELETE /api/sports/profiles/[id] —— 软删除 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "id 无效" }, { status: 400 });
  const token = await currentSessionToken();
  const userId = token ? await currentUserId() : null;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  await pgPool.query(
    `UPDATE sports_profiles SET deleted_at = now(), is_public = false
      WHERE user_id = $1 AND id = $2`,
    [userId, id]
  );
  return NextResponse.json({ ok: true });
}
