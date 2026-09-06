import { describe, it, expect, vi, beforeEach } from "vitest";

const clientMock = {
  query: vi.fn(
    async (_sql?: string, _params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> => ({ rows: [] })
  ),
  release: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  pgPool: { connect: vi.fn(() => clientMock) },
}));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(async () => ({ token: "tok-1", expiresAt: new Date("2030-01-01") })),
  sessionCookieName: "lwb_session",
}));

import { POST } from "./route";
import { resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  vi.unstubAllEnvs();
  clientMock.query.mockImplementation(async () => ({ rows: [] }));
});

describe("POST /api/auth/register", () => {
  it("rejects invalid username / short password", async () => {
    const r1 = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "a", password: "123" }),
    }));
    expect(r1.status).toBe(400);
    const r2 = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "ok_user", password: "123" }),
    }));
    expect(r2.status).toBe(400);
    expect(clientMock.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO accounts"));
  });

  it("returns 409 with a vague message when username already exists (anti-enumeration)", async () => {
    clientMock.query
      .mockImplementationOnce(async () => ({ rows: [] }))   // BEGIN
      .mockImplementationOnce(async () => ({ rows: [{ 1: 1 }] })); // SELECT dup
    const res = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "dup_user", password: "123456" }),
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).not.toContain("已被注册");
  });

  it("returns 429 when the same IP registers too often", async () => {
    let res: Response | undefined;
    for (let i = 0; i < 6; i++) {
      res = await POST(new Request("http://localhost/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `user_${i}`, password: "123456" }),
      }));
    }
    expect(res!.status).toBe(429);
  });

  it("grants admin only to ADMIN_USERNAME in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_USERNAME", "boss");
    const res = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "boss", password: "123456" }),
    }));
    expect(res.status).toBe(200);
    const insertCall = clientMock.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO users"));
    expect((insertCall![1] as unknown[])[3]).toBe(true);

    // 非指定账号：即使是首个用户也不授予管理员
    vi.clearAllMocks();
    clientMock.query.mockImplementation(async () => ({ rows: [] }));
    await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "someone", password: "123456" }),
    }));
    const insert2 = clientMock.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO users"));
    expect((insert2![1] as unknown[])[3]).toBe(false);
  });

  it("creates account + session on success", async () => {
    const res = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "new_user", password: "123456" }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user.username).toBe("new_user");
    const sqls = clientMock.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((q) => q.includes("INSERT INTO users"))).toBe(true);
    expect(sqls.some((q) => q.includes("INSERT INTO accounts"))).toBe(true);
    expect(sqls).toContain("COMMIT");
  });
});
