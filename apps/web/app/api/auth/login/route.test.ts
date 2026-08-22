import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(async () => "scrypt:65536:8:1:salt:hash"),
  needsRehash: vi.fn(() => false),
}));
vi.mock("@/lib/session", () => ({ createSession: vi.fn(), sessionCookieName: "lwb_session" }));
vi.mock("@/lib/anon", () => ({ getAnonId: vi.fn(async () => "anon-1") }));

import { pgPool } from "@/lib/db";
import { verifyPassword, needsRehash } from "@/lib/password";
import { createSession } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const verifyMock = vi.mocked(verifyPassword);
const createSessionMock = vi.mocked(createSession);
const needsRehashMock = vi.mocked(needsRehash);

const ACCOUNT = {
  rows: [{ password_hash: "scrypt:65536:8:1:salt:hash", user_id: "u-1", displayName: "Alice" }],
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  needsRehashMock.mockReturnValue(false);
});

describe("POST /api/auth/login", () => {
  it("returns 400 when fields are missing", async () => {
    const res = await post({ username: "", password: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "请输入账号和密码" });
  });

  it("returns 401 when credentials are wrong (records failure, no lock yet)", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    verifyMock.mockReturnValue(Promise.resolve(false) as never);
    const res = await post({ username: "alice", password: "bad" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "账号或密码错误" });
  });

  it("returns 429 when account is locked after too many failures", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 5, last: new Date() }] } as never);
    verifyMock.mockReturnValue(Promise.resolve(false) as never);
    const res = await post({ username: "alice", password: "bad" });
    expect(res.status).toBe(429);
  });

  it("claims device-scoped anonymous data, creates a session and sets a secure cookie", async () => {
    queryMock.mockResolvedValue(ACCOUNT as never);
    verifyMock.mockReturnValue(Promise.resolve(true) as never);
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);
    const expiresAt = new Date("2026-09-12T00:00:00.000Z");
    createSessionMock.mockResolvedValue({ token: "tok-123", expiresAt } as never);

    const res = await post({ username: "alice", password: "pw" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, token: "tok-123", user: { id: "u-1", username: "alice", displayName: "Alice" } });

    // 设备化认领：只认领 anon_id 匹配的行（不再无条件继承全部匿名数据）
    const tables = [
      "topic_progress", "daily_tasks", "focus_sessions", "checkins",
      "log_entries", "certificates", "xp_events", "resume_assets",
    ];
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    for (const t of tables) {
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE " + t + " SET user_id = $1, anon_id = NULL WHERE user_id IS NULL AND anon_id = $2"),
        ["u-1", "anon-1"]
      );
    }
    // 未声明 claimLegacy：不得认领历史遗留行（anon_id IS NULL）
    const legacyCalls = client.query.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes("anon_id IS NULL")
    );
    expect(legacyCalls).toHaveLength(0);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(getAnonId).toHaveBeenCalled();

    // session cookie 设置（生产环境带 secure）
    expect(res.cookies.get("lwb_session")?.value).toBe("tok-123");
    expect(createSessionMock).toHaveBeenCalledWith("u-1");
  });

  it("upgrades legacy password hash on successful login", async () => {
    queryMock.mockResolvedValue({ rows: [{ password_hash: "salt:hash", user_id: "u-1", displayName: "Alice" }] } as never);
    verifyMock.mockReturnValue(Promise.resolve(true) as never);
    needsRehashMock.mockReturnValue(true);
    const client = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);
    const expiresAt = new Date("2026-09-12T00:00:00.000Z");
    createSessionMock.mockResolvedValue({ token: "tok-123", expiresAt } as never);

    const res = await post({ username: "alice", password: "pw" });
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE accounts SET password_hash = $1"),
      [expect.any(String), "u-1"]
    );
  });

  it("rethrows when the anonymous claim transaction fails", async () => {
    queryMock.mockResolvedValue(ACCOUNT as never);
    verifyMock.mockReturnValue(Promise.resolve(true) as never);
    const client = {
      query: vi.fn().mockRejectedValueOnce(new Error("boom")),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as never);
    await expect(post({ username: "alice", password: "pw" })).rejects.toThrow("boom");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });
});