import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/api", () => ({ getRoadmapWithProgress: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { getRoadmapWithProgress } from "@/lib/api";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const getRoadmapMock = vi.mocked(getRoadmapWithProgress);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/roadmap", () => {
  it("returns phases for the requested career", async () => {
    getRoadmapMock.mockResolvedValue([{ id: 1, phaseKey: "p1", topics: [] }] as never);
    const res = await GET(new Request("http://localhost/api/roadmap?career=frontend"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ phases: [{ id: 1, phaseKey: "p1", topics: [] }] });
    expect(getRoadmapMock).toHaveBeenCalledWith("u-1", "frontend", null);
  });

  it("returns 500 when the database is unavailable", async () => {
    getRoadmapMock.mockRejectedValue(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(new Request("http://localhost/api/roadmap"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "数据库暂不可用" });
    errSpy.mockRestore();
  });
});
