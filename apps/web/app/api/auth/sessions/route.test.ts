import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({
  currentUserId: vi.fn(),
  currentSessionToken: vi.fn(),
  sessionCookieName: "lwb_session",
  sessionTokenHash: vi.fn(), isSecureRequest: () => false }));

import { pgPool } from "@/lib/db";
import { currentSessionToken, currentUserId, sessionTokenHash } from "@/lib/session";
import { GET, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userMock = vi.mocked(currentUserId);
const tokenMock = vi.mocked(currentSessionToken);
const hashMock = vi.mocked(sessionTokenHash);

const baseRow = {
  id: "aaaaaaaaaaaa",
  deviceLabel: "Chrome · Windows",
  userAgent: "Mozilla/5.0",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  lastUsedAt: new Date("2026-10-18T00:00:00Z"),
  expiresAt: new Date("2026-10-31T00:00:00Z"),
  tokenHash: "hash-current",
};

beforeEach(() => {
  vi.resetAllMocks();
  hashMock.mockReturnValue("hash-current");
});

describe("GET /api/auth/sessions", () => {
  it("未登录 → 401，不查库", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("列出未过期会话：id 前缀 + 设备信息 + current 标记，且不泄露 token_hash", async () => {
    userMock.mockResolvedValue("u-1");
    tokenMock.mockResolvedValue("tok-current");
    queryMock.mockResolvedValue({
      rows: [baseRow, { ...baseRow, id: "bbbbbbbbbbbb", tokenHash: "hash-other", deviceLabel: null }],
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0]).toEqual({
      id: "aaaaaaaaaaaa",
      deviceLabel: "Chrome · Windows",
      userAgent: "Mozilla/5.0",
      createdAt: "2026-10-01T00:00:00.000Z",
      lastUsedAt: "2026-10-18T00:00:00.000Z",
      expiresAt: "2026-10-31T00:00:00.000Z",
      current: true,
    });
    expect(body.sessions[1].current).toBe(false);
    expect(JSON.stringify(body)).not.toContain("hash-");
    expect(JSON.stringify(body)).not.toContain("tokenHash");

    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain("WHERE user_id = $1 AND expires_at > now()");
    expect(String(sql)).toContain("left(replace(id::text, '-', ''), 12)");
    expect(params).toEqual(["u-1"]);
  });

  it("没有当前令牌时 current 全为 false", async () => {
    userMock.mockResolvedValue("u-1");
    tokenMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [baseRow] } as never);
    const body = await (await GET()).json();
    expect(body.sessions[0].current).toBe(false);
    expect(hashMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/auth/sessions", () => {
  const req = (id?: string) =>
    new Request("http://localhost/api/auth/sessions" + (id === undefined ? "" : "?id=" + id), { method: "DELETE" });

  it("未登录 → 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await DELETE(req("aaaaaaaaaaaa"));
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("id 缺失/格式非法 → 400", async () => {
    userMock.mockResolvedValue("u-1");
    for (const bad of [undefined, "", "abc", "zzzzzzzzzzzz", "aaaaaaaaaaaaa1"]) {
      const res = await DELETE(req(bad));
      expect(res.status).toBe(400);
    }
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("会话不存在/已过期 → 404", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(req("aaaaaaaaaaaa"));
    expect(res.status).toBe(404);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("越权吊销别人的会话 → 403，且不执行 DELETE", async () => {
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [{ id: "uuid-x", user_id: "u-2", token_hash: "hash-other" }] } as never);
    const res = await DELETE(req("aaaaaaaaaaaa"));
    expect(res.status).toBe(403);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("吊销自己的其他设备 → ok，不清当前 cookie", async () => {
    userMock.mockResolvedValue("u-1");
    tokenMock.mockResolvedValue("tok-current");
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "uuid-x", user_id: "u-1", token_hash: "hash-other" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const res = await DELETE(req("aaaaaaaaaaaa"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, current: false });
    expect(queryMock).toHaveBeenNthCalledWith(2, "DELETE FROM sessions WHERE id = $1", ["uuid-x"]);
    expect(res.cookies.get("lwb_session")).toBeUndefined();
  });

  it("吊销当前会话 → current:true 并清 cookie", async () => {
    userMock.mockResolvedValue("u-1");
    tokenMock.mockResolvedValue("tok-current");
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "uuid-cur", user_id: "u-1", token_hash: "hash-current" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const res = await DELETE(req("aaaaaaaaaaaa"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, current: true });
    expect(hashMock).toHaveBeenCalledWith("tok-current");
    expect(res.cookies.get("lwb_session")?.maxAge).toBe(0);
  });
});
