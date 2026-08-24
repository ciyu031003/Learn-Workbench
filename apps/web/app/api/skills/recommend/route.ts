import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { recommendSkillsForCareer } from "@/lib/skills";
import { logger } from "@/lib/logger";

// 技能画像冷启动：按目标职业（settings.career）推荐技能，供一键添加
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const { rows } = await pgPool.query<{ value: unknown }>(
      `SELECT value FROM settings WHERE user_id = $1 AND key = 'career'`,
      [userId]
    );
    const careerKey = String(rows[0]?.value ?? "ict");
    const result = await recommendSkillsForCareer(careerKey);
    return NextResponse.json(result);
  } catch (e) {
    logger.error("skills recommend error", e);
    return NextResponse.json({ error: "技能推荐失败" }, { status: 500 });
  }
}
