import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("@/lib/session", () => ({
  currentUserId: vi.fn(),
  currentSessionToken: vi.fn(),
  sessionTokenHash: vi.fn((t: string) => "hash:" + t),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));

import { pgPool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const hashMock = vi.mocked(hashPassword);
const verifyMock = vi.mocked(verifyPassword);
const currentUserIdMock = vi.mocked(currentUserId);
const currentSessionTokenMock = vi.mocked(currentSessionToken);
const rateLimitMock = vi.mocked(rateLimit);

/** 满足 S2-6 密码策略（8-128 位 + 非弱口令）的测试口令 */
const STRONG = "NewPass12345";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
});

describe("POST /api/auth/password", () => {
  it("returns 400 when the current password is missing", async () => {
    const res = await post({ currentPassword: "", newPassword: STRONG });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "请输入当前密码" });
  });

  it("returns 400 when the new password is too short", async () => {
    const res = await post({ currentPassword: "old", newPassword: "12345" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "密码至少 8 位" });
  });

  it("rejects common weak passwords from the shared policy (S2-6)", async () => {
    const res = await post({ currentPassword: "old", newPassword: "qwerty123" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "密码过于简单，请更换更强的密码" });
  });

  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await post({ currentPassword: "old", newPassword: STRONG });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "未登录" });
  });

  it("returns 429 with retryAfterSeconds when the per-user throttle trips (S2-2)", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });
    const res = await post({ currentPassword: "old", newPassword: STRONG });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "操作过于频繁，请稍后再试", retryAfter: 30 });
    expect(rateLimitMock).toHaveBeenCalledWith("auth:password:u-1", { limit: 5, windowMs: 60_000 });
    expect(queryMock).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the current password is wrong", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash" }] } as never);
    verifyMock.mockReturnValue(Promise.resolve(false) as never);
    const res = await post({ currentPassword: "wrong", newPassword: STRONG });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "当前密码错误" });
  });

  it("updates the password and invalidates other sessions", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    currentSessionTokenMock.mockResolvedValue("cur-tok");
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash" }] } as never);
    verifyMock.mockReturnValue(Promise.resolve(true) as never);
    hashMock.mockReturnValue(Promise.resolve("new-hash") as never);
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);

    const res = await post({ currentPassword: "old", newPassword: STRONG });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(client.query).toHaveBeenCalledWith("UPDATE accounts SET password_hash = $1 WHERE user_id = $2", ["new-hash", "u-1"]);
    // S2-3b：新会话明文 token 为 NULL，必须按 token_hash 比对（否则一条都删不掉）
    expect(client.query).toHaveBeenCalledWith("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", ["u-1", "hash:cur-tok"]);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("invalidates all sessions when no current token is available", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    currentSessionTokenMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash" }] } as never);
    verifyMock.mockReturnValue(Promise.resolve(true) as never);
    hashMock.mockReturnValue(Promise.resolve("new-hash") as never);
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);
    await post({ currentPassword: "old", newPassword: STRONG });
    expect(client.query).toHaveBeenCalledWith("DELETE FROM sessions WHERE user_id = $1", ["u-1"]);
  });
});
