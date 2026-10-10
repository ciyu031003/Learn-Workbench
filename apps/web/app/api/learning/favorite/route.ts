import { NextResponse } from "next/server";
import { learningFavoriteInputSchema } from "@learn-workbench/shared";
import { currentUserId } from "@/lib/session";
import { setFavorite } from "@/lib/learning-read";
import { logger } from "@/lib/logger";

/** POST /api/learning/favorite —— 收藏 / 取消收藏知识点（软删除，可再次收藏） */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = learningFavoriteInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "收藏数据无效" }, { status: 400 });
  }
  try {
    return NextResponse.json(await setFavorite(userId, parsed.data));
  } catch (error) {
    logger.error("learning favorite error", error);
    return NextResponse.json({ error: "收藏操作失败" }, { status: 500 });
  }
}
