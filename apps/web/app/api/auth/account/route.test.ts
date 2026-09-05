import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/http", () => ({
  parseBody: vi.fn(async (req: Request) => ({ ok: true, data: await req.json().catch(() => ({})) })),
}));
vi.mock("@/lib/session", () => ({
  currentUserId: vi.fn(),
  destroySession: vi.fn(async () => {}),
  sessionCookieName: "lwb_session",
}));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { DELETE } from "./route";

const userIdMock = vi.mocked(currentUserId);
const queryMock = vi.mocked(pgPool.query);
const verifyMock = vi.mocked(verifyPassword);
beforeEach(() => vi.resetAllMocks());

function del(body: unknown = {}) {
  return DELETE(new Request("https://x.cn/api/auth/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("DELETE /api/auth/account", () => {
  it("requires login", async () => {
    userIdMock.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(401);
  });

  it("requires password confirmation for password accounts", async () => {
    userIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ password_hash: "scrypt:1" }] } as never);
    verifyMock.mockResolvedValue(false);
    const res = await del({ password: "wrong" });
    expect(res.status).toBe(403);
  });

  it("deletes account after password check", async () => {
    userIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ password_hash: "scrypt:1" }] } as never);
    verifyMock.mockResolvedValue(true);
    const res = await del({ password: "right" });
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  it("wechat-only accounts delete without password", async () => {
    userIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await del({});
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});
