import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { listQuestionAnswers } from "@/lib/interview";
import { logger } from "@/lib/logger";

/**
 * GET /api/questions/answers?ids=1,2,3 —— 快速过题用的只读答案接口（v1.31）。
 *
 * 与 `/api/questions` 的区别：那条**刻意不含答案**（防作弊），答案只在 `attempt` 提交后揭示。
 * 「面试前速览」不能走提交（会把浏览记成作答），所以这里单独开一条只读通道。
 * 鉴权口径与 `/api/questions` 完全一致（必须登录）；不写 attempts、不改任何统计。
 */
const MAX_IDS = 40;

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });

  try {
    const answers = await listQuestionAnswers(ids);
    return NextResponse.json({ answers });
  } catch (e) {
    logger.error("question answers error", e);
    return NextResponse.json({ error: "答案加载失败" }, { status: 500 });
  }
}
