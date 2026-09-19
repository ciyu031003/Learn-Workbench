import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { computeSportsRecord, handSchema } from "@learn-workbench/shared";

const SELECT_COLS = `id, sport_key AS "sportKey", identity, level_text AS "levelText",
  handedness, play_style AS "playStyle", photo_url AS "photoUrl", gear, highlights,
  matches_played AS "matchesPlayed", wins, losses, signature_move AS "signatureMove",
  shoe_size AS "shoeSize", tension_lbs AS "tensionLbs",
  is_public AS "isPublic", show_gear_images AS "showGearImages", share_slug AS "shareSlug", updated_at AS "updatedAt"`;

/** 归一化 gear/highlights 数组 */
export function normalizePairs(raw: unknown): { label: string; value: string; imageUrl?: string | null }[] {
  if (!Array.isArray(raw)) return [];
  const out: { label: string; value: string; imageUrl?: string | null }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? "").trim().slice(0, 40);
    const value = String(o.value ?? "").trim().slice(0, 120);
    if (!label) continue;
    const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.trim().slice(0, 2000) || null : null;
    out.push(imageUrl ? { label, value, imageUrl } : { label, value });
  }
  return out.slice(0, 20);
}

/** 归一化战绩数值（负数/NaN → 0，场次取 max(填写场次, 胜+负)） */
export function normalizeRecord(body: Record<string, unknown>) {
  return computeSportsRecord({
    matchesPlayed: Number(body.matchesPlayed),
    wins: Number(body.wins),
    losses: Number(body.losses),
  });
}

/** 归一化绝技文案 */
export function normalizeSignatureMove(raw: unknown): string | null {
  return typeof raw === "string" ? raw.trim().slice(0, 40) || null : null;
}

/** 归一化鞋码（自由文本，如 40 / 255mm） */
export function normalizeShoeSize(raw: unknown): string | null {
  return typeof raw === "string" ? raw.trim().slice(0, 12) || null : null;
}

/** 归一化磅数（0–40，保留一位小数；非法/越界归 null） */
export function normalizeTension(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 40) return null;
  return Math.round(value * 10) / 10;
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
  const record = normalizeRecord(body);
  const signatureMove = normalizeSignatureMove(body.signatureMove);
  const shoeSize = normalizeShoeSize(body.shoeSize);
  const tensionLbs = normalizeTension(body.tensionLbs);
  const wantsPublic = Boolean(body.isPublic);
  // 装备图开关只在公开时才有意义（取消公开时一并关掉，避免下次公开意外带图）
  const showGearImages = wantsPublic && Boolean(body.showGearImages);

  const { rows } = await pgPool.query(
    `INSERT INTO sports_profiles
       (user_id, sport_key, identity, level_text, handedness, play_style, photo_url, gear, highlights, is_public, share_slug,
        matches_played, wins, losses, signature_move, shoe_size, tension_lbs, show_gear_images)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (user_id, sport_key) WHERE deleted_at IS NULL
     DO UPDATE SET identity = EXCLUDED.identity, level_text = EXCLUDED.level_text,
       handedness = EXCLUDED.handedness, play_style = EXCLUDED.play_style, photo_url = EXCLUDED.photo_url,
       gear = EXCLUDED.gear, highlights = EXCLUDED.highlights, is_public = EXCLUDED.is_public,
       matches_played = EXCLUDED.matches_played, wins = EXCLUDED.wins, losses = EXCLUDED.losses,
       signature_move = EXCLUDED.signature_move, shoe_size = EXCLUDED.shoe_size, tension_lbs = EXCLUDED.tension_lbs,
       show_gear_images = EXCLUDED.show_gear_images,
       share_slug = COALESCE(sports_profiles.share_slug, EXCLUDED.share_slug),
       updated_at = now()
     RETURNING ${SELECT_COLS}`,
    [
      userId, sportKey, identity, levelText, handedness, playStyle, photoUrl,
      JSON.stringify(gear), JSON.stringify(highlights), wantsPublic, wantsPublic ? makeSlug() : null,
      record.matches, record.wins, record.losses, signatureMove, shoeSize, tensionLbs, showGearImages,
    ]
  );
  return NextResponse.json({ profile: rows[0] }, { status: 201 });
}
