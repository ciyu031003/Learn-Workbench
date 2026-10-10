import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/content/point-states", () => ({ pointStatesForTrack: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { pointStatesForTrack } from "@/lib/content/point-states";
import { GET } from "./route";

const userMock = vi.mocked(currentUserId);
const statesMock = vi.mocked(pointStatesForTrack);

function req(track?: string): Request {
  const url = new URL("http://localhost/api/learning/point-states");
  if (track) url.searchParams.set("track", track);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  userMock.mockResolvedValue("u1");
  statesMock.mockResolvedValue({
    trackSlug: "python",
    points: { "python/python-foundation/python-values-control": { read: true, practice: false, mastery: false, review: false, apply: false, accuracy: 0 } },
  });
});

describe("GET /api/learning/point-states", () => {
  it("未登录 → 401（学习态是隐私）", async () => {
    userMock.mockResolvedValue(null);
    expect((await GET(req("python"))).status).toBe(401);
    expect(statesMock).not.toHaveBeenCalled();
  });

  it("缺 track → 400", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  it("课程不存在 → 404", async () => {
    statesMock.mockResolvedValue(null);
    expect((await GET(req("ghost"))).status).toBe(404);
  });

  it("正常返回五状态", async () => {
    const res = await GET(req("python"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackSlug).toBe("python");
    expect(Object.keys(body.points)).toHaveLength(1);
  });
});
