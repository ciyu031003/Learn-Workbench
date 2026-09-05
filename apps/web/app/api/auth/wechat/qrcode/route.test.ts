import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/wechat", () => ({
  isWechatEnabled: vi.fn(),
  buildQrConnectUrl: vi.fn(() => "https://open.weixin.qq.com/connect/qrconnect?x=1"),
  createState: vi.fn(() => "123.abc.sig"),
  wechatRedirectUri: vi.fn(() => "https://learn.yuanabd.cn/login"),
}));
import { isWechatEnabled } from "@/lib/wechat";
import { GET } from "./route";

const enabledMock = vi.mocked(isWechatEnabled);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/auth/wechat/qrcode", () => {
  it("returns 503 when not configured", async () => {
    enabledMock.mockReturnValue(false);
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    expect(res.status).toBe(503);
  });

  it("returns authorize url and state", async () => {
    enabledMock.mockReturnValue(true);
    const res = await GET(new Request("https://learn.yuanabd.cn/api/auth/wechat/qrcode"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toContain("qrconnect");
    expect(body.state).toBe("123.abc.sig");
  });
});
