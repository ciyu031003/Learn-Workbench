import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { handSchema } from "@learn-workbench/shared";

const SELECT_COLS = `id, sport_key AS "sportKey", identity, level_text AS "levelText",
  handedness, play_style AS "playStyle", photo_url AS "photoUrl", gear, highlights,
  is_public AS "isPublic", share_slug AS "shareSlug", updated_at AS "updatedAt"`;

/** 归一化 gear/highlights 数组 */
export function normalizePairs(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { label: string; value: string }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? "").trim().slice(0, 40);
    const value = String(o.value ?? "").trim().slice(0, 120);
    if (!label) continue;
    out.push({ label, value });
  }
  return out.slice(0, 20);
}

function pickHand(raw: unknown): "left" | "right" | null {
  const p = handSchema.safeParse(raw);
  return p.success ? p.data : null;
}

/** 生成分享短链标识（仅登录用户的公开档案需要） */
function makeSlug(): string {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** GET /api/sports/profiles —— 当前用户的运动档案列表 */
export async function GET() {
  // 先取 token，避免空 token 进入 hashToken（踩坑点 34）
  const token = await currentSessionToken();
  const userId = token ? await currentUserId() : null;
  if (!userId) return NextResponse.json({ profiles: [] });

  const { rows } = await pgPool.query(
    `SELECT ${SELECT_COLS} FROM sports_profiles
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY updated_at DESC, id DESC`,
    [userId]
  );
  return NextResponse.json({ profiles: rows });
}

/** POST /api/sports/profiles —— 新建/更新某个运动的档案（按 sport_key 幂等 upsert） */
export async function POST(req: Request) {
  const token = await currentSessionToken();
  const userId = token ? await currentUserId() : null;
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const parsed = await parseBody(req, 256 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;

  const sportKey = String(body.sportKey ?? "").trim().slice(0, 40);
  if (!sportKey) return NextResponse.json({ error: "sportKey 不能为空" }, { status: 400 });

  const identity = typeof body.identity === "string" ? body.identity.trim().slice(0, 40) || null : null;
  const levelText = typeof body.levelText === "string" ? body.levelText.trim().slice(0, 40) || null : null;
  const handedness = pickHand(body.handedness);
  const playStyle = typeof body.playStyle === "string" ? body.playStyle.trim().slice(0, 40) || null : null;
  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim().slice(0, 2000) || null : null;
  const gear = normalizePairs(body.gear);
  const highlights = normalizePairs(body.highlights);
  const wantsPublic = Boolean(body.isPublic);

  const { rows } = await pgPool.query(
    `INSERT INTO sports_profiles
       (user_id, sport_key, identity, level_text, handedness, play_style, photo_url, gear, highlights, is_public, share_slug)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (user_id, sport_key) WHERE deleted_at IS NULL
     DO UPDATE SET identity = EXCLUDED.identity, level_text = EXCLUDED.level_text,
       handedness = EXCLUDED.handedness, play_style = EXCLUDED.play_style, photo_url = EXCLUDED.photo_url,
       gear = EXCLUDED.gear, highlights = EXCLUDED.highlights, is_public = EXCLUDED.is_public,
       share_slug = COALESCE(sports_profiles.share_slug, EXCLUDED.share_slug),
       updated_at = now()
     RETURNING ${SELECT_COLS}`,
    [
      userId, sportKey, identity, levelText, handedness, playStyle, photoUrl,
      JSON.stringify(gear), JSON.stringify(highlights), wantsPublic, wantsPublic ? makeSlug() : null,
    ]
  );
  return NextResponse.json({ profile: rows[0] }, { status: 201 });
}