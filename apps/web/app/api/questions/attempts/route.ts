import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { interviewStats, listAttempts } from "@/lib/interview";
import { logger } from "@/lib/logger";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const [attempts, stats] = await Promise.all([
      listAttempts(userId),
      interviewStats(userId),
    ]);
    return NextResponse.json({ attempts, stats });
  } catch (e) {
    logger.error("questions attempts error", e);
    return NextResponse.json({ error: "答题记录加载失败" }, { status: 500 });
  }
}
