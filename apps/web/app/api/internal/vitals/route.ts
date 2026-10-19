import { NextResponse } from "next/server";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { clientIp } from "@/lib/auth";
import { guardInternalRequest } from "@/lib/internal-guard";
import { rateLimit } from "@/lib/rate-limit";
import { parseWebVitalSample, recordVital, renderVitalsMetrics } from "@/lib/vitals";

/**
 * Web Vitals 采集端点（S6-8）。
 *
 * 为什么单独一个端点而不是复用 /api/internal/metrics：
 *  - metrics 是 internal-guard 保护的 GET（需要 CRON_SECRET / 内部角色），浏览器 beacon 带不了 secret；
 *  - 采集端必须匿名可写，抓取端必须内部可读 —— 两种信任等级分开放，避免为了上报把 metrics 的鉴权放宽。
 *
 * 隐私与滥用防护：
 *  - 只接收 lib/vitals.ts 的 5 个指标 + 脱敏路由，**不读 cookie/不存用户标识/不接 query**；
 *  - 同源校验（Origin 与 Host 不一致直接 403，防第三方站点刷指标）；
 *  - 每 IP 60 次/分钟限流 + 2KB body 上限 + zod 严格校验。
 */

const MAX_BODY_BYTES = 2048;
const RATE_LIMIT = { limit: 60, windowMs: 60_000 };

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // 部分浏览器的 sendBeacon 不带 Origin：不因此拒绝，靠限流 + 同源页面才能拿到我们的 JS 兜底
  if (!origin) return true;
  // 用 Host 头比较，而不是 new URL(req.url).host：Next 在反代/本地启动时 req.url 的
  // host 可能是 localhost/内部地址，与浏览器 Origin 的 host 不一致会误判 403（S6 实测）。
  // 用 Host 头比较，而不是只看 new URL(req.url).host：Next 在反代/本地启动时 req.url 的
  // host 可能是 localhost/内部地址，与浏览器 Origin 的 host 不一致会误判 403（S6 实测）。
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const candidates = [req.headers.get("host")];
  try {
    candidates.push(new URL(req.url).host);
  } catch {
    // req.url 非法时只依赖 Host 头
  }
  return candidates.some((h) => h === originHost);
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return apiError(403, "禁止跨站上报", { code: API_ERROR_CODES.forbidden });
  }

  const throttled = await rateLimit(`vitals:${clientIp(req)}`, RATE_LIMIT);
  if (!throttled.ok) {
    const limited = apiError(429, "上报过于频繁", {
      code: API_ERROR_CODES.rate_limited,
      retryAfterSeconds: throttled.retryAfterSeconds,
    });
    limited.headers.set("Retry-After", String(throttled.retryAfterSeconds));
    return limited;
  }

  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) {
    return apiError(413, "样本过大", { code: API_ERROR_CODES.validation_failed });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return apiError(400, "JSON 解析失败", { code: API_ERROR_CODES.validation_failed });
  }
  const sample = parseWebVitalSample(json);
  if (!sample) {
    return apiError(400, "样本格式不合法", { code: API_ERROR_CODES.validation_failed });
  }

  recordVital(sample);
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: Request) {
  const guard = await guardInternalRequest(req, "vitals", { limit: 120 });
  if (!guard.ok) return guard.response;
  return new NextResponse(renderVitalsMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
