import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("./db", () => ({
  pgPool: { query: vi.fn(), connect: vi.fn() },
}));

import { cookies, headers } from "next/headers";
import { pgPool } from "./db";
import { ANON_COOKIE, anonFilterSql, getAnonId, scopeWhere, userScope } from "./anon";
import { signAnonCookieValue } from "./anon-cookie";

const cookiesMock = vi.mocked(cookies);
const headersMock = vi.mocked(headers);
const queryMock = vi.mocked(pgPool.query);

const ANON = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  vi.resetAllMocks();
});

/**
 * 回归护栏：2026-09-15「未登录用户打开健康/职业等页面报错」。
 *
 * 根因：`userScope()` 直接 `await currentUserId()`，在**完全没有鉴权头**的请求上
 * 会把空 token 送进 `hashToken()` → `createHash().update(null)` 抛
 * `ERR_INVALID_ARG_TYPE`，接口 500（带任意非空 Bearer 反而正常）。
 * 这里把「匿名请求绝不查会话表、绝不抛错」钉死。
 */
describe("userScope 匿名路径（回归）", () => {
  it("无 cookie 且无 Authorization：不查库、不抛错、返回匿名作用域", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    headersMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);

    await expect(userScope()).resolves.toEqual({ uid: null, anonId: null });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("空的 Bearer（`Authorization: Bearer `）同样按未登录处理，不查库", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    // 注意：curl -H "Authorization: Bearer " 会命中这一支（slice(7).trim() === ""）
    headersMock.mockResolvedValue({ get: vi.fn().mockReturnValue("Bearer ") } as never);

    await expect(userScope()).resolves.toEqual({ uid: null, anonId: null });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("只有匿名设备 cookie 时返回 anonId（仍不查会话表）", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) => (name === ANON_COOKIE ? { value: ANON } : undefined)),
    } as never);
    headersMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);

    await expect(userScope()).resolves.toEqual({ uid: null, anonId: ANON });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("取 token 抛错（异常请求头）时降级为匿名，而不是 500", async () => {
    cookiesMock.mockRejectedValue(new Error("no request scope"));
    headersMock.mockRejectedValue(new Error("no request scope"));

    await expect(userScope()).resolves.toEqual({ uid: null, anonId: null });
  });

  it("有会话 cookie 时按登录用户解析（查 token_hash）", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) => (name === "lwb_session" ? { value: "tok" } : undefined)),
    } as never);
    headersMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    queryMock.mockResolvedValue({ rows: [{ user_id: "u-1" }] } as never);

    await expect(userScope()).resolves.toEqual({ uid: "u-1", anonId: null });
    expect(String(queryMock.mock.calls[0][0])).toContain("FROM sessions WHERE token_hash = $1");
  });
});

describe("签名匿名 cookie（S1-7）", () => {
  const SECRET = "test-secret-0123456789";
  const withCookie = (value: string) =>
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) => (name === ANON_COOKIE ? { value } : undefined)),
    } as never);

  beforeEach(() => {
    process.env.ANON_COOKIE_SECRET = SECRET;
    headersMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
  });
  afterEach(() => {
    delete process.env.ANON_COOKIE_SECRET;
  });

  it("接受服务端签名的值", async () => {
    withCookie(signAnonCookieValue(ANON));
    await expect(getAnonId()).resolves.toBe(ANON);
  });

  it("签名被篡改时返回 null（不能靠伪造 cookie 冒用他人匿名数据）", async () => {
    const signed = signAnonCookieValue(ANON);
    const tampered = signed.slice(0, signed.length - 2) + "zz";
    withCookie(tampered);
    await expect(getAnonId()).resolves.toBeNull();
  });

  it("非 UUID 形态的任意字符串返回 null", async () => {
    withCookie("not-a-uuid");
    await expect(getAnonId()).resolves.toBeNull();
  });

  it("anonFilterSql 不再并入 NULL 池（回归：跨设备读写漏洞）", () => {
    const sql = anonFilterSql(2);
    expect(sql).not.toContain("anon_id IS NULL");
    expect(sql).toContain("anon_id IS NOT DISTINCT FROM $2");
  });
});

describe("getAnonId / scopeWhere", () => {
  it("无 cookie 返回 null（空串也归一化为 null）", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "" }) } as never);
    await expect(getAnonId()).resolves.toBeNull();
  });

  it("已登录时 scopeWhere 不加匿名过滤", () => {
    const w = scopeWhere({ uid: "u-1", anonId: null }, ["u-1"]);
    expect(w).toEqual({ params: ["u-1"], sql: "" });
  });

  it("匿名时追加 anon_id 过滤并补参数", () => {
    const w = scopeWhere({ uid: null, anonId: ANON }, [null]);
    expect(w.params).toEqual([null, ANON]);
    expect(w.sql).toBe(` AND ${anonFilterSql(2)}`);
  });
});
