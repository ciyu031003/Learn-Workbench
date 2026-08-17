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

beforeEach(() => {
  vi.clearAllMocks();
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

  it("returns 409 when username already exists", async () => {
    clientMock.query
      .mockImplementationOnce(async () => ({ rows: [] }))   // BEGIN
      .mockImplementationOnce(async () => ({ rows: [{ 1: 1 }] })); // SELECT dup
    const res = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "dup_user", password: "123456" }),
    }));
    expect(res.status).toBe(409);
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
