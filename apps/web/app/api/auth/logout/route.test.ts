import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({
  destroySession: vi.fn(),
  sessionCookieName: "lwb_session",
  currentSessionToken: vi.fn(),
}));
import { currentSessionToken, destroySession } from "@/lib/session";
import { POST } from "./route";

const destroyMock = vi.mocked(destroySession);
const tokenMock = vi.mocked(currentSessionToken);

beforeEach(() => {
  vi.clearAllMocks();
  destroyMock.mockResolvedValue();
});

describe("POST /api/auth/logout", () => {
  it("用 cookie 会话吊销并清 cookie", async () => {
    tokenMock.mockResolvedValue("tok-1");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(destroyMock).toHaveBeenCalledWith("tok-1");
    expect(res.cookies.get("lwb_session")?.maxAge).toBe(0);
  });

  it("Bearer（移动端）也能吊销会话（S2-4）", async () => {
    tokenMock.mockResolvedValue("bearer-tok");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(destroyMock).toHaveBeenCalledWith("bearer-tok");
    // 无 cookie 的客户端也会收到清除 cookie（无害）
    expect(res.cookies.get("lwb_session")?.maxAge).toBe(0);
  });

  it("没有会话令牌时也返回 ok，不触碰数据库", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(destroyMock).not.toHaveBeenCalled();
  });
});
