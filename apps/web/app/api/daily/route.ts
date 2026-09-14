import { NextResponse } from "next/server";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { buildDailyOs } from "@/lib/daily-os";
import { logger } from "@/lib/logger";

/**
 * GET /api/daily —— Daily OS 聚合（只读）
 * 汇总当日 Learning / Career / Fitness / Habit；匿名设备同样可用（按 anon_id 隔离）。
 */
export async function GET() {
  try {
    // 先取 token，避免空 token 进入 hashToken（踩坑点 34）
    const token = await currentSessionToken();
    const userId = token ? await currentUserId() : null;
    const anonId = userId ? null : await getAnonId();
    const data = await buildDailyOs({ uid: userId, anonId });
    return NextResponse.json(data);
  } catch (e) {
    logger.error("daily os api error", e);
    return NextResponse.json({ error: "数据暂时不可用" }, { status: 500 });
  }
}