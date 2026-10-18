import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/wechat", () => ({
  isWechatEnabled: vi.fn(),
  buildQrConnectUrl: vi.fn(() => "https://open.weixin.qq.com/connect/qrconnect?x=1"),
  createStateWithNonce: vi.fn(() => ({ state: "123.abc.sig", nonce: "abc" })),
  wechatRedirectUri: vi.fn(() => "https://learn.yuanabd.cn/login"),
  WECHAT_STATE_COOKIE: "lwb_wx_state",
  WECHAT_STATE_MAX_AGE_SECONDS: 600,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/auth", () => ({ clientIp: vi.fn(() => "1.2.3.4") }));
import { createStateWithNonce, isWechatEnabled } from "@/lib/wechat";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth";
import { GET } from "./route";

const enabledMock = vi.mocked(isWechatEnabled);
const createStateMock = vi.mocked(createStateWithNonce);
const rateLimitMock = vi.mocked(rateLimit);
const clientIpMock = vi.mocked(clientIp);

beforeEach(() => {
  vi.resetAllMocks();
  enabledMock.mockReturnValue(true);
  createStateMock.mockReturnValue({ state: "123.abc.sig", nonce: "abc" });
  rateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  clientIpMock.mockReturnValue("1.2.3.4");
});

describe("GET /api/auth/wechat/qrcode", () => {
  it("returns 503 when not configured", async () => {
    enabledMock.mockReturnValue(false);
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    expect(res.status).toBe(503);
  });

  it("returns authorize url and state, and sets a one-time HttpOnly cookie", async () => {
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toContain("qrconnect");
    expect(body.state).toBe("123.abc.sig");

    const cookie = res.cookies.get("lwb_wx_state");
    expect(cookie?.value).toBe("abc");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBe(600);
    expect(cookie?.path).toBe("/");
  });

  it("rate limits anonymous state minting by client IP", async () => {
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    expect(res.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledWith("wechat-qrcode:1.2.3.4", {
      limit: 20,
      windowMs: 60_000,
    });
  });

  it("returns 429 when the IP exceeds the throttle", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "请求过于频繁，请稍后再试", retryAfter: 42 });
    expect(createStateMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the state secret is unavailable", async () => {
    createStateMock.mockReturnValue(null);
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    expect(res.status).toBe(503);
  });
});
