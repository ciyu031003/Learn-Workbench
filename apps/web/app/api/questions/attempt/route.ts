import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { createAttempt } from "@/lib/interview";
import { interviewAttemptInputSchema } from "@learn-workbench/shared";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = interviewAttemptInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "作答数据无效" }, { status: 400 });
  }
  try {
    const { attempt, isCorrect, answer } = await createAttempt(userId, parsed.data);
    return NextResponse.json({ attempt, isCorrect, answer }, { status: 201 });
  } catch (e) {
    logger.error("questions attempt error", e);
    return NextResponse.json({ error: "提交作答失败" }, { status: 500 });
  }
}
