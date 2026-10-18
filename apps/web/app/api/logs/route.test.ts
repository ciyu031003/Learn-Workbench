import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/anon", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, userScope: vi.fn(), getAnonId: vi.fn() };
});
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/anon-quota", () => ({ assertAnonWriteAllowed: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope } from "@/lib/anon";
import { rateLimit } from "@/lib/rate-limit";
import { assertAnonWriteAllowed } from "@/lib/anon-quota";
import { currentUserId } from "@/lib/session";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

const userScopeMock = vi.mocked(userScope);
const rateLimitMock = vi.mocked(rateLimit);
const quotaMock = vi.mocked(assertAnonWriteAllowed);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
  userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  quotaMock.mockResolvedValue({ ok: true, count: 0, limit: 500 });
});

describe("GET /api/logs", () => {
  it("clamps the limit between 1 and 200", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ value: "ict" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ value: "ict" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    await GET(new Request("http://localhost/api/logs?limit=9999"));
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.any(String), ["u-1", "ict", 200]);
    await GET(new Request("http://localhost/api/logs?limit=0"));
    expect(queryMock).toHaveBeenNthCalledWith(4, expect.any(String), ["u-1", "ict", 1]);
  });

  it("filters by an explicit career param", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/logs?limit=50&career=english"));
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", "english", 50]);
  });
});

describe("POST /api/logs", () => {
  it("returns 400 for an invalid kind", async () => {
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "bad", title: "t", content: "c" }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "kind 无效", code: "validation_failed" });
  });

  it("returns 400 when title or content is empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "review", title: "", content: "" }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "标题与内容不能为空", code: "validation_failed" });
  });

  it("creates a log entry", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 3, kind: "feynman" }] } as never);
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "feynman", title: "费曼", content: "讲稿" }),
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ log: { id: 3, kind: "feynman" } });
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", "feynman", "ict", "费曼", "讲稿"]);
  });

  it("匿名设备超配额 → 429 quota_exceeded，不写库", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "dev-1" });
    quotaMock.mockResolvedValue({ ok: false, reason: "quota", count: 500, limit: 500 });
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "review", title: "t", content: "c" }),
      })
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "quota_exceeded" });
    expect(quotaMock).toHaveBeenCalledWith({ uid: null, anonId: "dev-1" }, "log_entries");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("匿名设备正常写入：落 anon_id 并受 30/min 限流", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "dev-1" });
    queryMock.mockResolvedValue({ rows: [{ id: 9, kind: "review" }] } as never);
    const res = await POST(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "review", title: "t", content: "c" }),
      })
    );
    expect(res.status).toBe(201);
    expect(rateLimitMock).toHaveBeenCalledWith("logs:post:dev-1", { limit: 30, windowMs: 60000 });
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["dev-1", "review", "ict", "t", "c"]);
  });
});
