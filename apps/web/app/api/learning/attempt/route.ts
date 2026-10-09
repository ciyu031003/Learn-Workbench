import { NextResponse } from "next/server";
import { learningAttemptInputSchema } from "@learn-workbench/shared";
import { currentUserId } from "@/lib/session";
import { recordLearningAttempt } from "@/lib/learning";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = learningAttemptInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "练习提交数据无效" }, { status: 400 });
  }
  try {
    return NextResponse.json(await recordLearningAttempt(userId, parsed.data), { status: 201 });
  } catch (error) {
    logger.error("learning attempt error", error);
    return NextResponse.json({ error: "练习提交失败" }, { status: 500 });
  }
}

