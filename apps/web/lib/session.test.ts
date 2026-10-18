import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("./db", () => ({
  pgPool: { query: vi.fn(), connect: vi.fn() },
}));

import { cookies, headers } from "next/headers";
import { pgPool } from "./db";
import { createHash } from "node:crypto";
import {
  currentSessionToken,
  currentUserId,
  currentUser,
  createSession,
  destroySession,
  deviceLabelFromUserAgent,
  sessionCookieName,
  sessionTokenHash,
  touchSession,
} from "./session";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const cookiesMock = vi.mocked(cookies);
const headersMock = vi.mocked(headers);
const queryMock = vi.mocked(pgPool.query);

const withCookie = (value?: string) =>
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue(value === undefined ? undefined : { value }),
  } as never);
const withUserAgent = (ua?: string) =>
  headersMock.mockResolvedValue({
    get: vi.fn((name: string) => (name === "user-agent" ? ua : undefined)),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sessionTokenHash（防御式：空 token 不能抛错）", () => {
  it("null / undefined / 空串都归一化为 sha256('')，不抛错", () => {
    expect(sessionTokenHash(null)).toBe(sha256(""));
    expect(sessionTokenHash(undefined)).toBe(sha256(""));
    expect(sessionTokenHash("")).toBe(sha256(""));
    expect(() => sessionTokenHash(null)).not.toThrow();
  });

  it("正常 token 是 sha256 十六进制", () => {
    expect(sessionTokenHash("tok")).toBe(sha256("tok"));
    expect(sessionTokenHash("tok")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("currentSessionToken", () => {
  it("returns the cookie value when present", async () => {
    withCookie("cookie-token");
    await expect(currentSessionToken()).resolves.toBe("cookie-token");
  });

  it("falls back to the Authorization Bearer header", async () => {
    withCookie();
    headersMock.mockResolvedValue({
      get: vi.fn().mockReturnValue("Bearer header-token"),
    } as never);
    await expect(currentSessionToken()).resolves.toBe("header-token");
  });

  it("returns null when neither cookie nor bearer header exists", async () => {
    withCookie();
    headersMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
    await expect(currentSessionToken()).resolves.toBeNull();
  });
});

describe("currentUserId", () => {
  it("returns null without a token", async () => {
    withCookie();
    await expect(currentUserId()).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns the user id from an active session (lookup by token hash)", async () => {
    withCookie("tok");
    queryMock.mockResolvedValue({ rows: [{ user_id: "u-1" }] } as never);
    await expect(currentUserId()).resolves.toBe("u-1");
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain("FROM sessions WHERE token_hash = $1");
    expect(params).toEqual([sha256("tok")]);
  });

  it("命中会话时在同一条语句里刷新 last_used_at（节流窗口）", async () => {
    withCookie("tok");
    queryMock.mockResolvedValue({ rows: [{ user_id: "u-1" }] } as never);
    await currentUserId();
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("UPDATE sessions SET last_used_at = now()");
    expect(sql).toContain("last_used_at < now() - interval '60 seconds'");
    expect(queryMock).toHaveBeenCalledTimes(1); // 不额外多一次 UPDATE 往返
  });

  it("returns null when the session is missing/expired", async () => {
    withCookie("tok");
    queryMock.mockResolvedValue({ rows: [] } as never);
    await expect(currentUserId()).resolves.toBeNull();
  });
});

describe("touchSession", () => {
  it("空 hash 直接返回 null，不查库", async () => {
    await expect(touchSession(null)).resolves.toBeNull();
    await expect(touchSession("")).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("返回命中的 user_id", async () => {
    queryMock.mockResolvedValue({ rows: [{ user_id: "u-2" }] } as never);
    await expect(touchSession(sha256("tok"))).resolves.toBe("u-2");
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM sessions WHERE token_hash = $1"), [sha256("tok")]);
  });
});

describe("currentUser", () => {
  it("maps the joined session row", async () => {
    withCookie("tok");
    queryMock.mockResolvedValue({
      rows: [{ id: "u-1", username: "alice", displayName: "Alice" }],
    } as never);
    await expect(currentUser()).resolves.toEqual({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
    });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("JOIN accounts");
    expect(sql).toContain("UPDATE sessions SET last_used_at = now()");
    expect(queryMock.mock.calls[0][1]).toEqual([sha256("tok")]);
  });

  it("returns null without a token", async () => {
    withCookie();
    await expect(currentUser()).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("createSession", () => {
  it("只写 token_hash（不再双写明文 token），30 天过期", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const before = Date.now();
    const { token, expiresAt } = await createSession("u-1");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const ttlMs = expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(29 * 24 * 3600 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(30 * 24 * 3600 * 1000 + 1000);

    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toContain("INSERT INTO sessions");
    // 列清单里只有 token_hash，没有明文 token 列
    expect(text).toMatch(/INSERT INTO sessions \(token_hash, user_id, expires_at, last_used_at, user_agent, device_label\)/);
    expect(text).not.toMatch(/INSERT INTO sessions \(token,/);
    // $1 是哈希，不是原文；明文 token 绝不出现在参数里
    expect(params?.[0]).toBe(sha256(token));
    expect(params).not.toContain(token);
    expect(params?.[1]).toBe("u-1");
    expect(params?.[2]).toBe(expiresAt);
    expect(params?.[3]).toBeNull(); // 无请求头上下文 → UA null
    expect(params?.[4]).toBeNull();
  });

  it("记录 UA 与归一化设备标签", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    withUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36");
    await createSession("u-1");
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(params[3]).toContain("Windows NT 10.0");
    expect(params[4]).toBe("Chrome · Windows");
  });

  it("UA 读取抛错（非请求上下文）也照常建会话", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    headersMock.mockRejectedValue(new Error("no request scope"));
    await expect(createSession("u-1")).resolves.toMatchObject({ token: expect.any(String) });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("destroySession", () => {
  it("只按 token_hash 删（不再按明文 token 删）", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await destroySession("tok");
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain("DELETE FROM sessions WHERE token_hash = $1");
    expect(String(sql)).not.toContain("OR token =");
    expect(params).toEqual([sha256("tok")]);
  });

  it("空 token 直接返回，不发任何 SQL（防御式）", async () => {
    await destroySession(null);
    await destroySession(undefined);
    await destroySession("");
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("deviceLabelFromUserAgent", () => {
  it("识别浏览器 + 系统", () => {
    expect(
      deviceLabelFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36")
    ).toBe("Chrome · Windows");
    expect(deviceLabelFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15")).toBe("Safari · macOS");
    expect(deviceLabelFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1")).toBe("Safari · iPhone");
    expect(deviceLabelFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0")).toBe("Edge · Windows");
    expect(deviceLabelFromUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0")).toBe("Firefox · Linux");
  });

  it("识别移动端 App（okhttp / CFNetwork）", () => {
    expect(deviceLabelFromUserAgent("okhttp/4.9.2")).toBe("移动端 App");
    expect(deviceLabelFromUserAgent("LearnWorkbench/1.0 CFNetwork/1490 Darwin/23.0.0")).toBe("移动端 App");
  });

  it("空值 / 无法识别时安全降级", () => {
    expect(deviceLabelFromUserAgent(null)).toBeNull();
    expect(deviceLabelFromUserAgent(undefined)).toBeNull();
    expect(deviceLabelFromUserAgent("   ")).toBeNull();
    expect(deviceLabelFromUserAgent("SomeCustomClient/1.0")).toBe("SomeCustomClient/1.0");
  });
});

describe("sessionCookieName", () => {
  it("is the expected cookie name", () => {
    expect(sessionCookieName).toBe("lwb_session");
  });
});
