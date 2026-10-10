import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning-read", () => ({ learningLibraryState: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { learningLibraryState } from "@/lib/learning-read";
import { GET } from "./route";

const userMock = vi.mocked(currentUserId);
const stateMock = vi.mocked(learningLibraryState);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/learning/library-state", () => {
  it("未登录 → 401", async () => {
    userMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/learning/library-state"));
    expect(res.status).toBe(401);
  });

  it("不带 track 时拉全量，带 track 时按课程过滤", async () => {
    userMock.mockResolvedValue("u-1");
    stateMock.mockResolvedValue({ read: [], favorites: [], counts: { read: 0, favorites: 0, readThisWeek: 0 } });
    await GET(new Request("http://localhost/api/learning/library-state"));
    expect(stateMock).toHaveBeenLastCalledWith("u-1", undefined);
    await GET(new Request("http://localhost/api/learning/library-state?track=python"));
    expect(stateMock).toHaveBeenLastCalledWith("u-1", "python");
  });

  it("读失败 → 500（不回泄漏内部错误）", async () => {
    userMock.mockResolvedValue("u-1");
    stateMock.mockRejectedValue(new Error("relation \"knowledge_read_state\" does not exist"));
    const res = await GET(new Request("http://localhost/api/learning/library-state"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("knowledge_read_state");
  });
});
