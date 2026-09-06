import { NextResponse } from "next/server";
import { getPublicStats } from "@/lib/market";

/**
 * 公开统计（无需登录）：供静态落地页展示实时数据。
 * 仅返回聚合计数，不包含任何用户数据。
 * P1：正常走每日预聚合快照（market_stats key='public' 单行读），
 * 多用户并发不再触发全表聚合；快照缺失时兜底实时计算。
 */
export async function GET() {
  try {
    const stats = await getPublicStats();
    const res = NextResponse.json(stats);
    // 数据每日一变：CDN/nginx 可短缓存，进一步隔离匿名流量
    res.headers.set(
      "Cache-Control",
      "public, max-age=60, s-maxage=600, stale-while-revalidate=3600"
    );
    return res;
  } catch {
    return NextResponse.json({ error: "统计暂不可用" }, { status: 503 });
  }
}
