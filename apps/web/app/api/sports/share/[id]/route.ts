import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { SPORT_CATALOG, toSportsShare, type SportsGearItem, type Hand } from "@learn-workbench/shared";

/**
 * GET /api/sports/share/[id] —— 公开运动档案（**无需登录**）
 * 只返回白名单字段（运动身份 / 等级 / 装备 / 战绩 / 公开成绩 / 照片 / 昵称）；
 * 绝不返回体重、年龄、身体测量、饮食、训练细节或个人记录。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // 支持数字 id 或 share_slug
  const numeric = Number(id);
  const byId = Number.isInteger(numeric) && numeric > 0;

  const { rows } = await pgPool.query<{
    sportKey: string; identity: string | null; levelText: string | null; handedness: Hand | null;
    playStyle: string | null; photoUrl: string | null; gear: SportsGearItem[]; highlights: SportsGearItem[];
    matchesPlayed: number; wins: number; losses: number; signatureMove: string | null;
    displayName: string | null;
  }>(
    `SELECT p.sport_key AS "sportKey", p.identity, p.level_text AS "levelText", p.handedness,
            p.play_style AS "playStyle", p.photo_url AS "photoUrl", p.gear, p.highlights,
            p.matches_played AS "matchesPlayed", p.wins, p.losses, p.signature_move AS "signatureMove",
            u.display_name AS "displayName"
       FROM sports_profiles p
       LEFT JOIN users u ON u.id = p.user_id
      WHERE ${byId ? "p.id = $1" : "p.share_slug = $1"}
        AND p.is_public = true AND p.deleted_at IS NULL
      LIMIT 1`,
    [byId ? numeric : id]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "未找到公开档案" }, { status: 404 });

  const sportName = SPORT_CATALOG.find((s) => s.key === row.sportKey)?.name ?? row.sportKey;
  const share = toSportsShare(
    {
      sportKey: row.sportKey,
      identity: row.identity,
      levelText: row.levelText,
      handedness: row.handedness,
      playStyle: row.playStyle,
      photoUrl: row.photoUrl,
      gear: Array.isArray(row.gear) ? row.gear : [],
      highlights: Array.isArray(row.highlights) ? row.highlights : [],
      matchesPlayed: Number(row.matchesPlayed) || 0,
      wins: Number(row.wins) || 0,
      losses: Number(row.losses) || 0,
      signatureMove: row.signatureMove,
    },
    sportName,
    row.displayName
  );
  return NextResponse.json({ share });
}
