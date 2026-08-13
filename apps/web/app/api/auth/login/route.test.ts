import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/session", () => ({ createSession: vi.fn(), sessionCookieName: "lwb_session" }));

import { pgPool } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const verifyMock = vi.mocked(verifyPassword);
const createSessionMock = vi.mocked(createSession);

const ACCOUNT = {
  rows: [{ password_hash: "salt:hash", user_id: "u-1", displayName: "Alice" }],
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
});

describe("POST /api/auth/login", () => {
  it("returns 400 when fields are missing", async () => {
    const res = await post({ username: "", password: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "请输入账号和密码" });
  });

  it("returns 401 when credentials are wrong", async () => {
    queryMock.mockResolvedValue(ACCOUNT as never);
    verifyMock.mockReturnValue(false);
    const res = await post({ username: "alice", password: "bad" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "账号或密码错误" });
  });

  it("claims anonymous data, creates a session and sets the cookie", async () => {
    queryMock.mockResolvedValue(ACCOUNT as never);
    verifyMock.mockReturnValue(true);
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    connectMock.mockResolvedValue(client as never);
    const expiresAt = new Date("2026-09-12T00:00:00.000Z");
    createSessionMock.mockResolvedValue({ token: "tok-123", expiresAt });

    const res = await post({ username: "alice", password: "pw" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, token: "tok-123", user: { id: "u-1", username: "alice", displayName: "Alice" } });

    // anonymous data claim: UPDATE per table inside a transaction
    const tables = [
      "topic_progress", "daily_tasks", "focus_sessions", "checkins",
      "log_entries", "certificates", "xp_events", "resume_assets",
    ];
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    for (const t of tables) {
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE " + t + " SET user_id = $1"),
        ["u-1"]
      );
    }
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();

    // session cookie set on the response
    expect(res.cookies.get("lwb_session")?.value).toBe("tok-123");
    expect(createSessionMock).toHaveBeenCalledWith("u-1");
  });

  it("rethrows when the anonymous claim transaction fails", async () => {
    queryMock.mockResolvedValue(ACCOUNT as never);
    verifyMock.mockReturnValue(true);
    const client = {
      query: vi.fn().mockRejectedValueOnce(new Error("boom")),
      release: vi.fn(),
    };
    connectMock.mockResolvedValue(client as never);
    await expect(post({ username: "alice", password: "pw" })).rejects.toThrow("boom");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });
});
