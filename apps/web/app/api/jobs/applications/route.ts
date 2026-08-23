import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { addApplication, applicationStats, listApplications } from "@/lib/job-applications";
import { jobApplicationStageSchema } from "@learn-workbench/shared";
import { logger } from "@/lib/logger";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const [applications, stats] = await Promise.all([
      listApplications(userId),
      applicationStats(userId),
    ]);
    return NextResponse.json({ applications, stats });
  } catch (e) {
    logger.error("applications list error", e);
    return NextResponse.json({ error: "求职列表加载失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const jobId = Number(body?.jobId);
  const stageRaw = String(body?.stage ?? "favorite");
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "jobId 无效" }, { status: 400 });
  }
  const stage = jobApplicationStageSchema.safeParse(stageRaw);
  if (!stage.success) return NextResponse.json({ error: "求职阶段无效" }, { status: 400 });
  try {
    const app = await addApplication(userId, jobId, stage.data);
    return NextResponse.json({ application: app }, { status: 201 });
  } catch (e) {
    logger.error("applications add error", e);
    return NextResponse.json({ error: "加入求职失败" }, { status: 500 });
  }
}
