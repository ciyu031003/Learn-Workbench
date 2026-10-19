import { NextResponse } from "next/server";
import { API_ERROR_CODES, apiError } from "@/lib/api-error";
import { getHealth } from "@/lib/health";

// 探活必须实时执行，不能被 Next 预渲染/缓存
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health —— 容器/进程探活（S4-2）
 *
 * 公开接口（不鉴权）；**不返回内部细节**（无错误消息/连接串/SQL）。
 *  - DB SELECT 1（800ms 超时）：up → 200 status=ok；down/超时 → 503 status=degraded
 *  - migrations = schema_migrations 最新 filename；读不到为 null，**不降级**
 *  - 所有响应 Cache-Control: no-store（探活结果不能被任何层缓存）
 *
 * 为什么不用 withApi(public)：探活每 20s 一次，接统一前门只会刷访问日志/请求 ID，
 * 而这里不需要鉴权、限流或 body 解析。**意外异常**仍走统一错误 envelope（apiError），
 * 与 api-inventory 的 envelope 棘轮一致；DB down 是有业务含义的「健康报告 503」，保持报告结构。
 */
export async function GET() {
  try {
    const report = await getHealth();
    return NextResponse.json(report, {
      status: report.db === "up" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // 理论不可达（getHealth 内部已兜底所有 DB/迁移读取失败）；兜底也绝不裸抛 500
    const res = apiError(503, "健康检查执行失败", { code: API_ERROR_CODES.internal_error });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
