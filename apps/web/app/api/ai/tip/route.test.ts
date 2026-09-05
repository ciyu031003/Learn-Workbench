import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@learn-workbench/shared", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, todayISO: vi.fn(() => "2026-08-29") };
});
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  queryMock.mockResolvedValue({ rows: [{ total: 3, done: 1, seconds: 3600 }] } as never);
});

describe("GET /api/ai/tip", () => {
  it("returns 503 { enabled:false } when AI_API_KEY missing", async () => {
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("requires login even when configured", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns tip from upstream with today context", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: " 还差两件事，先啃最难的那件 " } }] }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.tip).toBe("还差两件事，先啃最难的那件");
    // 上游请求体带模型与上下文
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/chat/completions");
    const payload = JSON.parse(init.body);
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.messages[0].content).toContain("任务 1/3 完成");
    expect(payload.messages[0].content).toContain("专注 60 分钟");
  });

  it("maps upstream failure to 502", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await GET();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.tip).toBeNull();
  });

  it("maps upstream timeout/abort to 504", async () => {
    vi.stubEnv("AI_API_KEY", "sk-test");
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    fetchMock.mockRejectedValueOnce(new Error("abort"));
    const res = await GET();
    expect(res.status).toBe(504);
  });
});
