import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/content/learning-repo", () => ({
  loadLearningTracks: vi.fn(),
  loadAlgorithmAnimations: vi.fn(async () => ({ demo: [{ caption: "帧", svg: "<svg/>" }] })),
}));
import { loadLearningTracks } from "@/lib/content/learning-repo";
import { GET } from "./route";

const tracksMock = vi.mocked(loadLearningTracks);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/learning/content", () => {
  it("returns tracks with track/question counts from the database", async () => {
    tracksMock.mockResolvedValue([
      { slug: "python", questions: [{ key: "a" }, { key: "b" }] },
      { slug: "java", questions: [{ key: "c" }] },
    ] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackCount).toBe(2);
    expect(body.questionCount).toBe(3);
    expect(body.tracks).toHaveLength(2);
    expect(Object.keys(body.animations)).toContain("demo");
  });

  it("returns 500 when the database read fails", async () => {
    tracksMock.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
