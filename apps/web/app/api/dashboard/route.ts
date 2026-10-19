import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { buildDashboardPayload } from "@/lib/dashboard-data";

/**
 * GET /api/dashboard —— 仪表盘聚合（兼容 API，S6-2 起逻辑下沉到 lib/dashboard-data.ts）
 *
 * Web 首屏已改由 (app)/dashboard 的 Server Component 直调同一 lib（不再走 XHR）；
 * 本路由保留给移动端/外部调用，响应 shape、错误文案、鉴权范围均与重构前一致。
 */
export async function GET() {
  try {
    return NextResponse.json(await buildDashboardPayload());
  } catch (e) {
    logger.error("dashboard api error", e);
    return NextResponse.json({ error: "数据库暂不可用" }, { status: 500 });
  }
}
