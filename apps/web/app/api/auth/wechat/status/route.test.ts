import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/wechat", () => ({ isWechatEnabled: vi.fn() }));
import { isWechatEnabled } from "@/lib/wechat";
import { GET } from "./route";

const enabledMock = vi.mocked(isWechatEnabled);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/auth/wechat/status", () => {
  it("reports disabled when env missing", async () => {
    enabledMock.mockReturnValue(false);
    const res = await GET();
    const body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it("reports enabled when configured", async () => {
    enabledMock.mockReturnValue(true);
    const res = await GET();
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });
});
