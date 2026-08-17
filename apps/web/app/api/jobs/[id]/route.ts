import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { getJobDetail } from "@/lib/jobs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效职位 ID" }, { status: 400 });
  }
  const userId = await currentUserId();
  const job = await getJobDetail(num, userId);
  if (!job) return NextResponse.json({ error: "职位不存在" }, { status: 404 });
  return NextResponse.json({ job });
}
