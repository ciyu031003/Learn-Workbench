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
import {
  interviewCrawlerRanSuccessfullyToday,
  triggerInterviewCrawl,
} from "@/lib/tasks/interview";
import { triggerFoodImport } from "@/lib/tasks/food";
import { triggerContentImport } from "@/lib/tasks/content-import";
import { guardInternalRequest } from "@/lib/internal-guard";
import { buildContentSyncPlan, readContentPackageVersion, syncKnowledgeModel } from "@/lib/content/knowledge-model";
import { logger } from "@/lib/logger";

/**
 * 服务器内部 cron 触发入口（每日统一批处理，替代"用户触发重活"）：
 *   ?job=crawl        抓取招聘数据（幂等守卫：今天已 success 则跳过；cron 补跑无害）
 *   ?job=aggregate    预计算市场分析 + 公开统计快照（爬完后的读路径数据源）
 *   ?job=backfill     单独补跑市场职位字段回填（例如 12:30 crawl 后立即调度）
 *   ?job=maintenance  清理过期会话/审计/重置令牌
 *   ?job=food         食物营养库导入（v6 P1-3；默认自建库，可 ?source=off&query=番茄鸡蛋面 追加 OFF 数据）
 *   ?job=interview    面试题库抓取（v1.26；同款锁 + 幂等守卫，参数 ?limit=N&dry=1）
 *   ?job=content      内容包 → 统一内容模型同步（组二 · 阶段 7；幂等，参数 ?dry=1 只预览差异）
 *   ?job=content-import  外部来源导入（组二 · 阶段 10；参数 ?source=<key> 必填、?mode=apply 才物化、?limit=N）
 *   ?job=all          依次执行 crawl/aggregate/maintenance（**不含 food 与 interview**，
 *                     content / content-import 同理不并入 all：排障时希望"内容"和"抓取"互不影响）
 *
 * 鉴权：请求头 x-cron-secret 必须等于环境变量 CRON_SECRET；
 *       CRON_SECRET 未配置时一律 403（部署脚本会生成并写入 crontab，见 deploy.sh）。
 * 推荐 crontab（flock 防重叠，由 deploy.sh 自动配置）：
 *   30 4 * * *  flock -n /tmp/lwb-cron-crawl.lock  curl -fsS -X POST -H "x-cron-secret: …" "http://127.0.0.1:3001/api/internal/cron?job=crawl"
 *   40 5 * * *  … ?job=aggregate
 *   10 6 * * *  … ?job=maintenance
 *   20 6 * * *  flock -n /tmp/lwb-cron-interview.lock curl -fsS -X POST -H "x-cron-secret: …" "http://127.0.0.1:3001/api/internal/cron?job=interview"
 */

const VALID_JOBS = [
  "crawl",
  "aggregate",
  "backfill",
  "maintenance",
  "food",
  "interview",
  "content",
  "content-import",
  "all",
] as const;

export async function POST(req: Request) {
  // H2：内部接口统一前门（先限流再验密钥）。cron 由 crontab flock 调度，
  // 宽松限流（120/分钟）只为拦住"误配代理把内部接口暴露到公网后的暴力探测"。
  const guard = await guardInternalRequest(req, "cron", { limit: 120 });
  if (!guard.ok) return guard.response;

  const job = new URL(req.url).searchParams.get("job") || "all";
  if (!(VALID_JOBS as readonly string[]).includes(job)) {
    return NextResponse.json(
      { error: "job 无效，应为 crawl/aggregate/backfill/maintenance/food/interview/content/content-import/all" },
      { status: 400 }
    );
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

  if (job === "food") {
    // v6 P1-3：食物营养库导入（默认自建中餐库；OFF/USDA 需显式指定 source）
    const params = new URL(req.url).searchParams;
    const source = (params.get("source") || "builtin").slice(0, 10);
    const query = (params.get("query") || "").slice(0, 40);
    const args = [`--source=${source}`];
    if (query) args.push(`--query=${query}`);
    result.food = await triggerFoodImport(args);
  }

  if (job === "interview") {
    // v1.26：面试题库每日抓取（与岗位爬虫同款：锁 + 运行记录 + 当天已成功则跳过）
    if (await interviewCrawlerRanSuccessfullyToday()) {
      result.interview = { skipped: true, reason: "already-succeeded-today" };
    } else {
      const params = new URL(req.url).searchParams;
      const limitRaw = Number(params.get("limit"));
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(800, Math.round(limitRaw)) : undefined;
      result.interview = await triggerInterviewCrawl("cron", {
        limit,
        dryRun: params.get("dry") === "1",
      });
    }
  }

  if (job === "content") {
    // 组二 · 阶段 7：把内容包（packages/content）同步进统一内容模型；
    // 幂等（指纹相同即 unchanged），?dry=1 只回报差异不写库。
    const params = new URL(req.url).searchParams;
    const git = readContentPackageVersion();
    const plan = buildContentSyncPlan({ contentVersion: git.version, contentUpdatedAt: git.updatedAt });
    const synced = await syncKnowledgeModel(plan, { dryRun: params.get("dry") === "1" });
    result.content = { dryRun: params.get("dry") === "1", ...synced, stats: undefined };
  }

  if (job === "content-import") {
    // 组二 · 阶段 10：外部来源导入（detached）。默认 dry-run，?mode=apply 才物化 review 草稿。
    const params = new URL(req.url).searchParams;
    const limitRaw = Number(params.get("limit"));
    result.contentImport = await triggerContentImport("cron", {
      sourceKey: params.get("source") ?? "",
      mode: params.get("mode") === "apply" ? "apply" : "dry-run",
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.round(limitRaw)) : undefined,
      ref: params.get("ref") ?? undefined,
    });
  }

  if (job === "maintenance" || job === "all") {
    result.maintenance = await cleanupExpiredData();
    // 登录异常量监控（24h 失败量超阈值 → logger.warn 告警，配合日志采集通知）
    result.security = await securityAlerts();
  }

  logger.info("[internal/cron] job done:", job);
  return NextResponse.json(result);
}
