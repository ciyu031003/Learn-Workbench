import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { fetchBingWallpapers } from "@/lib/background/bing";

// 手动触发抓取 Bing 壁纸（P10：改为 Node 入库实现，不再依赖 python 脚本；要求登录 + 限流）
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const throttle = await rateLimit(`bg:refresh:${userId}`, { limit: 2, windowMs: 120_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds }, { status: 429 });
  }

  try {
    const result = await fetchBingWallpapers({ days: 2 });
    return NextResponse.json({
      ok: result.failed.length === 0,
      saved: result.saved,
      updated: result.updated,
      dates: result.dates,
      failed: result.failed,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "抓取失败" },
      { status: 500 }
    );
  }
}
