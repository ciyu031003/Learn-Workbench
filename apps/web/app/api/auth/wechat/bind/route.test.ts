import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn(async () => ({ ok: true, data: { code: "c", state: "s" } })) }));
vi.mock("@/lib/wechat", () => ({
  verifyState: vi.fn(() => true),
  exchangeCode: vi.fn(),
  isWechatEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/identities", () => ({
  bindWechatIdentity: vi.fn(),
  canUnbindWechat: vi.fn(),
  unbindWechat: vi.fn(),
}));
import { currentUserId } from "@/lib/session";
import { exchangeCode } from "@/lib/wechat";
import { bindWechatIdentity, canUnbindWechat, unbindWechat } from "@/lib/identities";
import { POST, DELETE } from "./route";

const userIdMock = vi.mocked(currentUserId);
const exchangeMock = vi.mocked(exchangeCode);
const bindMock = vi.mocked(bindWechatIdentity);
const canUnbindMock = vi.mocked(canUnbindWechat);
const unbindMock = vi.mocked(unbindWechat);
beforeEach(() => vi.resetAllMocks());

function post() {
  return POST(new Request("https://x.cn/api/auth/wechat/bind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "c", state: "s" }),
  }));
}

describe("/api/auth/wechat/bind", () => {
  it("POST binds identity for logged-in user", async () => {
    userIdMock.mockResolvedValue("u-1");
    bindMock.mockResolvedValue("bound");
    exchangeMock.mockResolvedValue({ openid: "ox", unionid: null, nickname: null, avatarUrl: null });
    const res = await post();
    const body = await res.json();
    expect(body.bound).toBe(true);
  });

  it("POST conflicts when wechat owned by others", async () => {
    userIdMock.mockResolvedValue("u-1");
    bindMock.mockResolvedValue("conflict");
    exchangeMock.mockResolvedValue({ openid: "ox", unionid: null, nickname: null, avatarUrl: null });
    const res = await post();
    expect(res.status).toBe(409);
  });

  it("POST refuses when logged out", async () => {
    userIdMock.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(401);
  });

  it("DELETE refuses when wechat is the only login method", async () => {
    userIdMock.mockResolvedValue("u-1");
    canUnbindMock.mockResolvedValue(false);
    const res = await DELETE();
    expect(res.status).toBe(400);
  });

  it("DELETE unbinds when another method exists", async () => {
    userIdMock.mockResolvedValue("u-1");
    canUnbindMock.mockResolvedValue(true);
    unbindMock.mockResolvedValue(true);
    const res = await DELETE();
    const body = await res.json();
    expect(body.unbound).toBe(true);
  });

  it("DELETE 404 when not bound", async () => {
    userIdMock.mockResolvedValue("u-1");
    canUnbindMock.mockResolvedValue(true);
    unbindMock.mockResolvedValue(false);
    const res = await DELETE();
    expect(res.status).toBe(404);
  });
});
