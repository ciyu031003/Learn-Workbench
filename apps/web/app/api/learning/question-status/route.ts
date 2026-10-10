import { NextResponse } from "next/server";
import { listQuestionStatuses, questionStatusCounts } from "@/lib/content/question-lifecycle";
import { logger } from "@/lib/logger";

/**
 * GET /api/learning/question-status —— 题目生命周期状态（组二 · 阶段 12 剩余）。
 *
 * 公开只读：题库总览页据此给「非已发布」的题叠角标（草稿/待审/已下线）。
 * 库不可用（迁移未跑 / 连接抖动）时**降级为 available:false + 空列表**，
 * 前端按「全部视为已发布」渲染 —— 浏览题目不应该因为状态读不到而整页失败。
 */
export async function GET() {
  try {
    const [statuses, counts] = await Promise.all([listQuestionStatuses(), questionStatusCounts()]);
    return NextResponse.json({
      available: true,
      counts,
      statuses: statuses.map((row) => ({ key: row.key, status: row.status })),
    });
  } catch (error) {
    logger.warn("question status unavailable", error);
    return NextResponse.json({ available: false, counts: null, statuses: [] });
  }
}
