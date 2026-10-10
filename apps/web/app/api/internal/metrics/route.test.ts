import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pgPool } from "@/lib/db";
import { resetMetrics } from "@/lib/metrics";
import { resetRateLimits } from "@/lib/rate-limit";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);

function req(secret = "s3cr3t", ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/internal/metrics", {
    method: "GET",
    headers: { "x-cron-secret": secret, "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  resetMetrics();
  resetRateLimits();
  process.env.CRON_SECRET = "s3cr3t";
  // 默认：所有 DB 查询返回 0
  queryMock.mockResolvedValue({ rows: [{ n: "0", total: "0", ok: "0" }] } as never);
});

describe("GET /api/internal/metrics", () => {
  it("密钥错误 → 403，不泄漏任何指标", async () => {
    const res = await GET(req("wrong"));
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("lwb_process");
  });

  it("密钥正确 → Prometheus 文本格式 + 正确的 Content-Type", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("# HELP lwb_process_uptime_seconds");
    expect(body).toContain("# TYPE lwb_process_uptime_seconds gauge");
    expect(body).toContain("lwb_content_knowledge_points 0");
    expect(body).toContain("lwb_review_due_cards 0");
  });

  it("库不可用（查询全抛）→ 仍然 200，只给进程指标（监控端点不能因为缺表而挂）", async () => {
    queryMock.mockRejectedValue(new Error("relation does not exist"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("lwb_process_uptime_seconds");
    expect(body).not.toContain("lwb_content_knowledge_points");
  });

  it("导入成功率为 0 批时给 1（不制造假告警）", async () => {
    const res = await GET(req());
    expect(await res.text()).toContain("lwb_content_import_success_ratio_30d 1");
  });

  it("超过限流阈值 → 429（防被当免费压测入口）", async () => {
    for (let i = 0; i < 120; i += 1) await GET(req("s3cr3t", "10.9.9.9"));
    const res = await GET(req("s3cr3t", "10.9.9.9"));
    expect(res.status).toBe(429);
  });
});
