import { NextResponse } from "next/server";
import { buildWellbeingToday } from "@/lib/dashboard-data";

/**
 * GET /api/wellbeing/today —— 今日健康/精力聚合（兼容 API，S6-2 起逻辑下沉到 lib/dashboard-data.ts）
 *
 * Web 首屏（dashboard Server Component）直调同一 lib；本路由保留给移动端/外部调用，
 * 响应 shape 与鉴权（匿名可用）范围与重构前一致。
 */
export async function GET() {
  return NextResponse.json(await buildWellbeingToday());
}
