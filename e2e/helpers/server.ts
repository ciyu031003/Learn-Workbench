import type { APIRequestContext } from "@playwright/test";

/**
 * S6-9：目标站点可用性探测（缓存一次/worker）。
 *
 * 为什么要它：没有服务时，Playwright 默认的表现是**每条用例各自 ECONNREFUSED 红一片**，
 * 日志里看不出"是环境没起还是功能坏了"。这里在 fixture 的 beforeEach 里统一探一次 /login：
 *  - 200/3xx → 继续；
 *  - 连不上/5xx → 全部用例 SKIP，并打印/展示统一原因（报告里一眼能看懂）。
 */
export interface ServerProbe {
  ok: boolean;
  status: number | null;
  reason: string;
}

let cached: ServerProbe | null = null;

export async function probeServer(request: APIRequestContext): Promise<ServerProbe> {
  if (cached) return cached;
  try {
    const res = await request.get("/login", { timeout: 5000, maxRedirects: 0, failOnStatusCode: false });
    const status = res.status();
    cached =
      status >= 200 && status < 500
        ? { ok: true, status, reason: "目标站点可用（/login HTTP " + status + "）" }
        : {
            ok: false,
            status,
            reason:
              "目标站点 /login 返回 HTTP " + status + "（期望 200/3xx）：确认 E2E_BASE_URL 指向已启动的 web 服务，且页面未整体报错",
          };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cached = {
      ok: false,
      status: null,
      reason:
        "目标站点不可达（" + msg + "）：先启动 pnpm -F web dev 或 docker compose up -d，或设置 E2E_BASE_URL 指向已部署环境",
    };
  }
  return cached;
}

/** 仅测试内部使用：允许显式重置（同一 worker 内多环境切换时） */
export function resetServerProbe(): void {
  cached = null;
}
