import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { buildJobLearningPlan } from "@/lib/skills";
import { logger } from "@/lib/logger";

// 岗位学习计划（整包规划）：岗位信息 + 匹配度 + 按路线图阶段分组的能力缺口计划
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效职位 ID" }, { status: 400 });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const plan = await buildJobLearningPlan(userId, num);
    return NextResponse.json(plan);
  } catch (e) {
    logger.error("job plan error", e);
    return NextResponse.json({ error: "学习计划生成失败" }, { status: 500 });
  }
}
