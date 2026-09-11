import { NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/domains/market/analysis";
import { refreshPublicStats } from "@/lib/domains/market/public-stats";
import { backfillMarketJobAttributes } from "@/lib/domains/market/enrich";
import { writeMarketDimensionSnapshots } from "@/lib/domains/market/snapshots";
import { cleanupExpiredData, securityAlerts } from "@/lib/maintenance";
import {
  crawlerRanSuccessfullyToday,
  triggerCrawlerJobs,
  type CrawlerEngineResult,
} from "@/lib/tasks/crawler";
import { logger } from "@/lib/logger";

/**
 * 服务器内部 cron 触发入口（每日统一批处理，替代"用户触发重活"）：
 *   ?job=crawl        抓取招聘数据（幂等守卫：今天已 success 则跳过；cron 补跑无害）
 *   ?job=aggregate    预计算市场分析 + 公开统计快照（爬完后的读路径数据源）
 *   ?job=backfill     单独补跑市场职位字段回填（例如 12:30 crawl 后立即调度）
 *   ?job=maintenance  清理过期会话/审计/重置令牌
 *   ?job=all          依次执行以上三项
 *
 * 鉴权：请求头 x-cron-secret 必须等于环境变量 CRON_SECRET；
 *       CRON_SECRET 未配置时一律 403（部署脚本会生成并写入 crontab，见 deploy.sh）。
 * 推荐 crontab（flock 防重叠，由 deploy.sh 自动配置）：
 *   30 4 * * *  flock -n /tmp/lwb-cron-crawl.lock  curl -fsS -X POST -H "x-cron-secret: …" "http://127.0.0.1:3001/api/internal/cron?job=crawl"
 *   40 5 * * *  … ?job=aggregate
 *   10 6 * * *  … ?job=maintenance
 */

const VALID_JOBS = ["crawl", "aggregate", "backfill", "maintenance", "all"] as const;

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const got = req.headers.get("x-cron-secret")?.trim();
  return !!got && got === expected;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const job = new URL(req.url).searchParams.get("job") || "all";
  if (!(VALID_JOBS as readonly string[]).includes(job)) {
    return NextResponse.json({ error: "job 无效，应为 crawl/aggregate/maintenance/all" }, { status: 400 });
  }

  const result: Record<string, unknown> = { ok: true, job };

  if (job === "crawl" || job === "all") {
    // 幂等守卫：今天已有成功抓取则跳过（cron 补跑/重复触发直接空转）
    if (await crawlerRanSuccessfullyToday()) {
      result.crawl = { skipped: true, reason: "already-succeeded-today" };
    } else {
      const engines: CrawlerEngineResult[] = await triggerCrawlerJobs("cron", "all");
      result.crawl = { engines };
    }
    result.marketBackfill = { enriched: await backfillMarketJobAttributes(2000) };
  }

  if (job === "aggregate" || job === "all") {
    // force：跳过缓存直接重算（写 market_stats key='full' + 当日 market_stats_history）
    await analyzeMarket({ force: true });
    const enriched = await backfillMarketJobAttributes(2000);
    const snapshotCount = await writeMarketDimensionSnapshots();
    result.aggregate = { ok: true, enriched, snapshotCount, publicStats: await refreshPublicStats() };
  }

  if (job === "backfill") {
    result.backfill = { enriched: await backfillMarketJobAttributes(2000) };
  }

  if (job === "maintenance" || job === "all") {
    result.maintenance = await cleanupExpiredData();
    // 登录异常量监控（24h 失败量超阈值 → logger.warn 告警，配合日志采集通知）
    result.security = await securityAlerts();
  }

  logger.info("[internal/cron] job done:", job);
  return NextResponse.json(result);
}
