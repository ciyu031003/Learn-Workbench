import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/http";
import { triggerCrawlerJobs, type CrawlerScope } from "@/lib/tasks/crawler";

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  // P0：爬虫触发为受限操作，仅管理员可执行（日常抓取由服务器 cron 承担，此处为手动兜底）
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "无权限执行爬虫任务" }, { status: 403 });
  }
  const throttle = await rateLimit(`crawler:run:${userId}`, { limit: 3, windowMs: 600_000 });
  if (!throttle.ok) {
    return NextResponse.json({ error: "操作过于频繁，请稍后再试", retryAfter: throttle.retryAfterSeconds }, { status: 429 });
  }

  const parsed = await parseBody(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const scope = body.scope ?? "all"; // all / official / internet
  if (scope !== "all" && scope !== "official" && scope !== "internet") {
    return NextResponse.json({ error: "scope 无效" }, { status: 400 });
  }

  const engines = await triggerCrawlerJobs(`admin:${userId}`, scope as CrawlerScope);
  if (engines.length > 0 && engines.every((e) => !e.started)) {
    return NextResponse.json(
      { error: "爬虫正在运行中，请稍后再试", engines },
      { status: 409 }
    );
  }
  return NextResponse.json({ started: true, engines });
}
