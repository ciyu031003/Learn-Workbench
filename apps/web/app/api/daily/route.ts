import { NextResponse } from "next/server";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { buildDailyOs } from "@/lib/daily-os";
import { readDateParam } from "@/lib/query";
import { logger } from "@/lib/logger";

/**
 * GET /api/daily —— Daily OS 聚合（只读）
 * 汇总当日 Learning / Career / Fitness / Habit；匿名设备同样可用（按 anon_id 隔离）。
 *
 * 可选 `?date=YYYY-MM-DD`：客户端本地日期。服务器在 UTC 时，东八区凌晨 0–8 点
 * 用服务端日期会算成"前一天"，导致饮食/运动等当天数据在健康主页与今日页显示为 0。
 */
export async function GET(req: Request) {
  try {
    // 先取 token，避免空 token 进入 hashToken（踩坑点 34）
    const token = await currentSessionToken();
    const userId = token ? await currentUserId() : null;
    const anonId = userId ? null : await getAnonId();
    const date = readDateParam(new URL(req.url).searchParams.get("date"));
    const data = await buildDailyOs({ uid: userId, anonId }, new Date(), date);
    return NextResponse.json(data);
  } catch (e) {
    logger.error("daily os api error", e);
    return NextResponse.json({ error: "数据暂时不可用" }, { status: 500 });
  }
}