import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { computeJobMatch } from "@/lib/skills";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效职位 ID" }, { status: 400 });
  }
  try {
    const userId = await currentUserId();
    const match = await computeJobMatch(userId, num);
    return NextResponse.json({ match });
  } catch (e) {
    console.error("job match error", e);
    return NextResponse.json({ error: "匹配度计算失败" }, { status: 500 });
  }
}
