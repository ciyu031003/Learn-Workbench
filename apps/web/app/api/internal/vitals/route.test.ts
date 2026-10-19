import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ clientIp: vi.fn(() => "1.2.3.4") }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/internal-guard", () => ({ guardInternalRequest: vi.fn() }));
vi.mock("@/lib/vitals", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, recordVital: vi.fn(), renderVitalsMetrics: vi.fn(() => "# ok\n") };
});

import { rateLimit } from "@/lib/rate-limit";
import { guardInternalRequest } from "@/lib/internal-guard";
import { recordVital } from "@/lib/vitals";
import { GET, POST } from "./route";

const rateLimitMock = vi.mocked(rateLimit);
const guardMock = vi.mocked(guardInternalRequest);
const recordVitalMock = vi.mocked(recordVital);

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/internal/vitals", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

const SAMPLE = { name: "LCP", value: 1800, rating: "good", route: "/dashboard" };

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  guardMock.mockResolvedValue({ ok: true, actorId: "system", actorRole: "system" } as never);
});

describe("POST /api/internal/vitals", () => {
  it("接受合法样本并记入聚合（204，无响应体）", async () => {
    const res = await POST(post(JSON.stringify(SAMPLE)));
    expect(res.status).toBe(204);
    expect(recordVitalMock).toHaveBeenCalledWith(SAMPLE);
  });

  it("拒绝非法 JSON / 非法指标（不写聚合）", async () => {
    expect((await POST(post("not-json"))).status).toBe(400);
    const bad = await POST(post(JSON.stringify({ name: "NOPE", value: 1, rating: "good", route: "/" })));
    expect(bad.status).toBe(400);
    expect(recordVitalMock).not.toHaveBeenCalled();
  });

  it("拒绝超过 2KB 的请求体（413）", async () => {
    const res = await POST(post(JSON.stringify({ ...SAMPLE, route: "/" + "z".repeat(3000) })));
    expect(res.status).toBe(413);
    expect(recordVitalMock).not.toHaveBeenCalled();
  });

  it("跨站 Origin 直接 403（防第三方刷指标）", async () => {
    const res = await POST(post(JSON.stringify(SAMPLE), { Origin: "https://evil.example.com" }));
    expect(res.status).toBe(403);
    expect(recordVitalMock).not.toHaveBeenCalled();
  });

  it("同源 Origin 放行", async () => {
    const res = await POST(post(JSON.stringify(SAMPLE), { Origin: "http://localhost" }));
    expect(res.status).toBe(204);
  });

  it("限流命中返回 429 + Retry-After", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 12 });
    const res = await POST(post(JSON.stringify(SAMPLE)));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });
});

describe("GET /api/internal/vitals", () => {
  it("无内部权限时返回 guard 的拒绝响应", async () => {
    guardMock.mockResolvedValue({ ok: false, response: new Response("nope", { status: 401 }) } as never);
    const res = await GET(new Request("http://localhost/api/internal/vitals"));
    expect(res.status).toBe(401);
  });

  it("有内部权限时返回 Prometheus 文本", async () => {
    const res = await GET(new Request("http://localhost/api/internal/vitals"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toContain("# ok");
  });
});
