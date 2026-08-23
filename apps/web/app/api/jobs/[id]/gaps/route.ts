import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { computeSkillGaps } from "@/lib/skills";
import { logger } from "@/lib/logger";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效职位 ID" }, { status: 400 });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const result = await computeSkillGaps(userId, num);
    return NextResponse.json(result);
  } catch (e) {
    logger.error("job gaps error", e);
    return NextResponse.json({ error: "能力缺口分析失败" }, { status: 500 });
  }
}
