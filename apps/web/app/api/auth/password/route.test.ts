import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));

import { pgPool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const hashMock = vi.mocked(hashPassword);
const verifyMock = vi.mocked(verifyPassword);
const currentUserIdMock = vi.mocked(currentUserId);
const currentSessionTokenMock = vi.mocked(currentSessionToken);

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
  vi.clearAllMocks();
});

describe("POST /api/auth/password", () => {
  it("returns 400 when the current password is missing", async () => {
    const res = await post({ currentPassword: "", newPassword: "abcdef" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "请输入当前密码" });
  });

  it("returns 400 when the new password is too short", async () => {
    const res = await post({ currentPassword: "old", newPassword: "12345" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "新密码至少 6 位" });
  });

  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await post({ currentPassword: "old", newPassword: "abcdef" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "未登录" });
  });

  it("returns 400 when the current password is wrong", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash" }] } as never);
    verifyMock.mockReturnValue(false);
    const res = await post({ currentPassword: "wrong", newPassword: "abcdef" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "当前密码错误" });
  });

  it("updates the password and invalidates other sessions", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    currentSessionTokenMock.mockResolvedValue("cur-tok");
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash" }] } as never);
    verifyMock.mockReturnValue(true);
    hashMock.mockReturnValue("new-hash");
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);

    const res = await post({ currentPassword: "old", newPassword: "abcdef" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(client.query).toHaveBeenCalledWith("UPDATE accounts SET password_hash = $1 WHERE user_id = $2", ["new-hash", "u-1"]);
    expect(client.query).toHaveBeenCalledWith("DELETE FROM sessions WHERE user_id = $1 AND token <> $2", ["u-1", "cur-tok"]);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("invalidates all sessions when no current token is available", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    currentSessionTokenMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash" }] } as never);
    verifyMock.mockReturnValue(true);
    hashMock.mockReturnValue("new-hash");
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);
    await post({ currentPassword: "old", newPassword: "abcdef" });
    expect(client.query).toHaveBeenCalledWith("DELETE FROM sessions WHERE user_id = $1", ["u-1"]);
  });
});
