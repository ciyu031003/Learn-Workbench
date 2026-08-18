import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { deleteSubscription } from "@/lib/jobs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效订阅 ID" }, { status: 400 });
  }
  const ok = await deleteSubscription(userId, num);
  if (!ok) return NextResponse.json({ error: "订阅不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
