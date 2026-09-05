import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/identities", () => ({ listIdentities: vi.fn() }));
vi.mock("@/lib/wechat", () => ({ isWechatEnabled: vi.fn(() => true) }));
import { currentUserId } from "@/lib/session";
import { listIdentities } from "@/lib/identities";
import { GET } from "./route";

const userIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listIdentities);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/auth/identities", () => {
  it("lists identities with masked uid", async () => {
    userIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([
      { provider: "wechat", provider_uid: "ox-abcdef", unionid: null, nickname: "N", avatar_url: "http://a" },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.identities[0].boundUid).toBe("ox-abc***");
    expect(body.wechatEnabled).toBe(true);
  });

  it("requires login", async () => {
    userIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
