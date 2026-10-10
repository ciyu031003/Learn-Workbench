import { pgPool } from "@/lib/db";
import { guardInternalRequest } from "@/lib/internal-guard";
import { logger } from "@/lib/logger";
import { renderMetrics, setGauge, type ExternalMetric } from "@/lib/metrics";

/**
 * GET /api/internal/metrics —— Prometheus 文本格式指标（组三 · H5 可观测）。
 *
 * 为什么不引 prom-client：单实例自用系统，`renderMetrics()` 的手写文本格式就是标准格式，
 * 抓取端（Prometheus / VictoriaMetrics / 甚至 curl + 日志）都能吃。
 *
 * 内容：进程指标（uptime/内存）+ 业务 gauge（内容规模、导入成功率、复习到期量）。
 * **降级策略**：任何一条 DB 查询失败都不 500 —— 迁移没上的库也要能拿到进程指标，
 * 否则"监控端点因为缺表而挂掉"本身就成了故障。
 */

const BOOT_AT = Date.now();

async function safeCount(sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pgPool.query<{ n: string }>(sql, params);
    return Number(rows[0]?.n ?? 0);
  } catch (error) {
    logger.debug("metrics query skipped", error);
    return null;
  }
}

export async function GET(req: Request) {
  const guard = await guardInternalRequest(req, "metrics", { limit: 120 });
  if (!guard.ok) return guard.response;

  setGauge("lwb_process_uptime_seconds", Math.floor((Date.now() - BOOT_AT) / 1000));
  const mem = process.memoryUsage();
  setGauge("lwb_process_resident_memory_bytes", mem.rss);
  setGauge("lwb_process_heap_used_bytes", mem.heapUsed);

  const external: ExternalMetric[] = [];
  const push = (name: string, help: string, value: number | null, type: "gauge" | "counter" = "gauge") => {
    if (value === null) return;
    external.push({ name, help, type, value });
  };

  push(
    "lwb_content_knowledge_points",
    "内容库里未软删除的知识点数",
    await safeCount(`SELECT count(*)::text AS n FROM knowledge_points WHERE deleted_at IS NULL`)
  );
  push(
    "lwb_content_question_links",
    "题 ↔ 知识点关联行数",
    await safeCount(`SELECT count(*)::text AS n FROM question_knowledge_point`)
  );
  push(
    "lwb_users_total",
    "用户总数",
    await safeCount(`SELECT count(*)::text AS n FROM users`)
  );
  push(
    "lwb_audit_log_total",
    "审计记录总数（H3）",
    await safeCount(`SELECT count(*)::text AS n FROM audit_log`)
  );

  // 导入成功率（近 30 天）：成功批次 / 全部批次。没有批次时给 1（不制造假告警）。
  const importStats = await safeText(
    `SELECT
       count(*)::text AS total,
       count(*) FILTER (WHERE status = 'success')::text AS ok
     FROM content_import_batch
     WHERE started_at > now() - interval '30 days'`
  );
  if (importStats) {
    const total = Number(importStats.total ?? 0);
    const ok = Number(importStats.ok ?? 0);
    push("lwb_content_import_success_ratio_30d", "近 30 天内容导入批次成功率", total === 0 ? 1 : ok / total);
    push("lwb_content_import_batches_30d", "近 30 天内容导入批次数", total, "counter");
  }

  push(
    "lwb_review_due_cards",
    "当前到期复习卡片数（SM-2）",
    await safeCount(`SELECT count(*)::text AS n FROM learning_review_cards WHERE due_at <= now()`)
  );

  return new Response(renderMetrics(external), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
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
