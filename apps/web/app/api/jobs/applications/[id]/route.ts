import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { deleteApplication, updateApplicationStage } from "@/lib/job-applications";
import { jobApplicationStageSchema } from "@learn-workbench/shared";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const stageRaw = String(body?.stage ?? "");
  const stage = jobApplicationStageSchema.safeParse(stageRaw);
  if (!stage.success) return NextResponse.json({ error: "求职阶段无效" }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note : undefined;
  try {
    const app = await updateApplicationStage(userId, num, stage.data, note);
    if (!app) return NextResponse.json({ error: "求职记录不存在" }, { status: 404 });
    return NextResponse.json({ application: app });
  } catch (e) {
    console.error("applications update error", e);
    return NextResponse.json({ error: "阶段更新失败" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const ok = await deleteApplication(userId, num);
    if (!ok) return NextResponse.json({ error: "求职记录不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("applications delete error", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
