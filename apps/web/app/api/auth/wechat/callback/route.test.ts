import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(async () => ({ token: "t-1", expiresAt: new Date() })),
  currentUser: vi.fn(),
  sessionCookieName: "lwb_session",
}));
vi.mock("@/lib/wechat", () => ({
  verifyState: vi.fn(() => true),
  exchangeCode: vi.fn(),
  isWechatEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/identities", () => ({
  findUserIdByWechat: vi.fn(),
  createWechatUser: vi.fn(),
  bindWechatIdentity: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ claimAnonData: vi.fn(async () => {}) }));
vi.mock("@/lib/anon", () => ({ getAnonId: vi.fn(async () => "anon-1") }));

import { pgPool } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { exchangeCode } from "@/lib/wechat";
import { findUserIdByWechat, createWechatUser, bindWechatIdentity } from "@/lib/identities";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserMock = vi.mocked(currentUser);
const exchangeCodeMock = vi.mocked(exchangeCode);
const findMock = vi.mocked(findUserIdByWechat);
const createMock = vi.mocked(createWechatUser);
const bindMock = vi.mocked(bindWechatIdentity);

function post(body: unknown) {
  return POST(new Request("https://learn.yuanabd.cn/api/auth/wechat/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => vi.resetAllMocks());

describe("POST /api/auth/wechat/callback", () => {
  it("rejects missing code/state", async () => {
    const res = await post({ code: "", state: "" });
    expect(res.status).toBe(400);
  });

  it("binds when already logged in", async () => {
    currentUserMock.mockResolvedValue({ id: "u-1", username: "tester", displayName: null });
    bindMock.mockResolvedValue("bound");
    exchangeCodeMock.mockResolvedValue({ openid: "ox-1", unionid: null, nickname: "n", avatarUrl: null });
    const res = await post({ code: "c", state: "s" });
    const body = await res.json();
    expect(body.bound).toBe(true);
  });

  it("conflicts when wechat belongs to another user", async () => {
    currentUserMock.mockResolvedValue({ id: "u-1", username: "tester", displayName: null });
    bindMock.mockResolvedValue("conflict");
    exchangeCodeMock.mockResolvedValue({ openid: "ox-1", unionid: null, nickname: "n", avatarUrl: null });
    const res = await post({ code: "c", state: "s" });
    expect(res.status).toBe(409);
  });

  it("logs in existing wechat identity", async () => {
    currentUserMock.mockResolvedValue(null);
    exchangeCodeMock.mockResolvedValue({ openid: "ox-1", unionid: null, nickname: "n", avatarUrl: null });
    findMock.mockResolvedValue("u-9");
    queryMock.mockResolvedValue({ rows: [{ username: "wx_ab12" }] } as never);
    const res = await post({ code: "c", state: "s" });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(false);
    expect(body.token).toBe("t-1");
  });

  it("creates a new user on first login", async () => {
    currentUserMock.mockResolvedValue(null);
    exchangeCodeMock.mockResolvedValue({ openid: "ox-2", unionid: null, nickname: "新用户", avatarUrl: null });
    findMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ userId: "u-new", username: "wx_cd34" });
    const res = await post({ code: "c", state: "s" });
    const body = await res.json();
    expect(body.created).toBe(true);
    expect(body.user.username).toBe("wx_cd34");
  });

  it("returns 401 when wechat exchange fails", async () => {
    currentUserMock.mockResolvedValue(null);
    exchangeCodeMock.mockResolvedValue(null);
    const res = await post({ code: "c", state: "s" });
    expect(res.status).toBe(401);
  });
});
