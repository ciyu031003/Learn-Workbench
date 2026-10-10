import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning-read", () => ({ setFavorite: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { setFavorite } from "@/lib/learning-read";
import { POST } from "./route";

const userMock = vi.mocked(currentUserId);
const favoriteMock = vi.mocked(setFavorite);

const valid = {
  pointKey: "java/java-foundation/java-types-control",
  trackSlug: "java",
  stageKey: "java-foundation",
  topicKey: "java-types-control",
  favorite: true,
};

function req(body: unknown): Request {
  return new Request("http://localhost/api/learning/favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/learning/favorite", () => {
  it("未登录 → 401", async () => {
    userMock.mockResolvedValue(null);
    expect((await POST(req(valid))).status).toBe(401);
  });

  it("缺少 favorite 布尔值 → 400", async () => {
    userMock.mockResolvedValue("u-1");
    const { favorite: _favorite, ...withoutFavorite } = valid;
    expect((await POST(req(withoutFavorite))).status).toBe(400);
    expect((await POST(req({ ...valid, favorite: "yes" }))).status).toBe(400);
  });

  it("收藏与取消都走同一入口，回传最终状态", async () => {
    userMock.mockResolvedValue("u-1");
    favoriteMock.mockResolvedValue({ pointKey: valid.pointKey, favorite: true, changed: true });
    const add = await POST(req(valid));
    expect(add.status).toBe(200);
    expect((await add.json()).favorite).toBe(true);

    favoriteMock.mockResolvedValue({ pointKey: valid.pointKey, favorite: false, changed: true });
    const remove = await POST(req({ ...valid, favorite: false }));
    expect((await remove.json()).favorite).toBe(false);
    expect(favoriteMock).toHaveBeenLastCalledWith("u-1", { ...valid, favorite: false });
  });
});
