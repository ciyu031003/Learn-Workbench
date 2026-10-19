import { pgPool } from "@/lib/db";
import { guardInternalRequest } from "@/lib/internal-guard";
import { logger } from "@/lib/logger";
import {
  collectPoolMetrics,
  collectProcessMetrics,
  metricsGenerationId,
  renderMetrics,
  type ExternalMetric,
  type PoolStatsLike,
} from "@/lib/metrics";

/**
 * GET /api/internal/metrics —— Prometheus 文本格式指标（组三 · H5 可观测）。
 *
 * 为什么不引 prom-client：单实例自用系统，renderMetrics() 的手写文本格式就是标准格式，
 * 抓取端（Prometheus / VictoriaMetrics / 甚至 curl + 日志）都能吃。
 *
 * 内容（S4-5 增补）：
 *  - 进程指标：uptime / RSS / heap used / heap total（collectProcessMetrics）；
 *  - **PG 连接池**：total / idle / waiting / max / usage_ratio（collectPoolMetrics）——
 *    宿主告警脚本 scripts/alert-check.mjs 用 usage_ratio > 0.8 判定"连接池要耗尽"；
 *  - 业务 gauge：内容规模、导入成功率、复习到期量；
 *  - 业务 COUNT 改为 **60s 进程内缓存**（4 个全表 COUNT + 导入批次统计）：告警脚本每 10 分钟
 *    抓一次 / 人工排查时不会把 COUNT 打到库上；缓存按 metricsGenerationId() 代际失效
 *    （resetMetrics 后立即重算，单测互不污染）。
 * **降级策略**：任何一条 DB 查询失败都不 500 —— 迁移没上的库也要能拿到进程/连接池指标，
 * 否则"监控端点因为缺表而挂掉"本身就成了故障。
 */

const BOOT_AT = Date.now();
/** COUNT 类指标的进程内缓存时长（毫秒）。60s 与告警脚本 10min 抓取频率兼容。 */
const COUNT_CACHE_TTL_MS = 60_000;

interface CachedNumber {
  value: number;
  at: number;
  generation: number;
}
interface CachedText {
  value: Record<string, string> | null;
  at: number;
  generation: number;
}

const countCache = new Map<string, CachedNumber>();
let importStatsCache: CachedText | null = null;

async function safeCount(sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pgPool.query<{ n: string }>(sql, params);
    return Number(rows[0]?.n ?? 0);
  } catch (error) {
    logger.debug("metrics query skipped", error);
    return null;
  }
}

async function safeText(sql: string): Promise<Record<string, string> | null> {
  try {
    const { rows } = await pgPool.query(sql);
    return (rows[0] as Record<string, string>) ?? null;
  } catch (error) {
    logger.debug("metrics query skipped", error);
    return null;
  }
}

/** 带代际失效的 COUNT 缓存：成功才写缓存（DB 故障不污染），失败返回 null（调用方跳过该指标）。 */
async function cachedCount(key: string, sql: string): Promise<number | null> {
  const generation = metricsGenerationId();
  const now = Date.now();
  const cur = countCache.get(key);
  if (cur && cur.generation === generation && now - cur.at < COUNT_CACHE_TTL_MS) return cur.value;
  const value = await safeCount(sql);
  if (value !== null) countCache.set(key, { value, at: now, generation });
  return value;
}

async function cachedImportStats(): Promise<Record<string, string> | null> {
  const generation = metricsGenerationId();
  const now = Date.now();
  if (
    importStatsCache &&
    importStatsCache.generation === generation &&
    now - importStatsCache.at < COUNT_CACHE_TTL_MS
  ) {
    return importStatsCache.value;
  }
  const value = await safeText(
    `SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE status = 'success')::text AS ok
     FROM content_import_batch
     WHERE started_at > now() - interval '30 days'`
  );
  if (value !== null) importStatsCache = { value, at: now, generation };
  return value;
}

export async function GET(req: Request) {
  const guard = await guardInternalRequest(req, "metrics", { limit: 120 });
  if (!guard.ok) return guard.response;

  // 1) 进程 + 连接池（不查库，永远可用；测试 mock 缺字段时自动跳过对应项）
  const pool = pgPool as unknown as PoolStatsLike;
  const poolMaxEnv = Number(process.env.PGPOOL_MAX || 0);
  const external: ExternalMetric[] = [
    ...collectProcessMetrics({ bootAt: BOOT_AT }),
    ...collectPoolMetrics(pool, poolMaxEnv > 0 ? poolMaxEnv : undefined),
  ];
  const push = (name: string, help: string, value: number | null, type: "gauge" | "counter" = "gauge") => {
    if (value === null) return;
    external.push({ name, help, type, value });
  };

  // 2) 业务规模（60s 缓存；失败则跳过该指标）
  push(
    "lwb_content_knowledge_points",
    "内容库里未软删除的知识点数",
    await cachedCount("knowledge_points", `SELECT count(*)::text AS n FROM knowledge_points WHERE deleted_at IS NULL`)
  );
  push(
    "lwb_content_question_links",
    "题 ↔ 知识点关联行数",
    await cachedCount("question_links", `SELECT count(*)::text AS n FROM question_knowledge_point`)
  );
  push("lwb_users_total", "用户总数", await cachedCount("users_total", `SELECT count(*)::text AS n FROM users`));
  push(
    "lwb_audit_log_total",
    "审计记录总数（H3）",
    await cachedCount("audit_log_total", `SELECT count(*)::text AS n FROM audit_log`)
  );

  // 3) 导入成功率（近 30 天）：成功批次 / 全部批次。没有批次时给 1（不制造假告警）。
  const importStats = await cachedImportStats();
  if (importStats) {
    const total = Number(importStats.total ?? 0);
    const ok = Number(importStats.ok ?? 0);
    push("lwb_content_import_success_ratio_30d", "近 30 天内容导入批次成功率", total === 0 ? 1 : ok / total);
    push("lwb_content_import_batches_30d", "近 30 天内容导入批次数", total, "counter");
  }

  push(
    "lwb_review_due_cards",
    "当前到期复习卡片数（SM-2）",
    await cachedCount("review_due_cards", `SELECT count(*)::text AS n FROM learning_review_cards WHERE due_at <= now()`)
  );

  return new Response(renderMetrics(external), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
