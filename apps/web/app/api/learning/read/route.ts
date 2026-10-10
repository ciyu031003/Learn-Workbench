import { NextResponse } from "next/server";
import { learningReadStateInputSchema } from "@learn-workbench/shared";
import { currentUserId } from "@/lib/session";
import { recordReadState } from "@/lib/learning-read";
import { logger } from "@/lib/logger";

/** POST /api/learning/read —— 记一次知识点阅读（进度只增不减，重复上报幂等） */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = learningReadStateInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "阅读状态数据无效" }, { status: 400 });
  }
  try {
    return NextResponse.json(await recordReadState(userId, parsed.data), { status: 201 });
  } catch (error) {
    logger.error("learning read state error", error);
    return NextResponse.json({ error: "阅读状态保存失败" }, { status: 500 });
  }
}
