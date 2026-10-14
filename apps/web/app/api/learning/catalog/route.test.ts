import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/learning", () => ({ learningCatalog: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/content/learning-repo", () => ({ loadLearningTracks: vi.fn(async () => []) }));
import { learningCatalog } from "@/lib/learning";
import { loadLearningTracks } from "@/lib/content/learning-repo";
import { GET } from "./route";

const catalogMock = vi.mocked(learningCatalog);
const tracksMock = vi.mocked(loadLearningTracks);

beforeEach(() => {
  vi.clearAllMocks();
  tracksMock.mockResolvedValue([] as never);
});

describe("GET /api/learning/catalog", () => {
  it("returns the learning catalog loaded from the database", async () => {
    catalogMock.mockReturnValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).tracks).toEqual([]);
    expect(catalogMock).toHaveBeenCalledWith([]);
  });

  it("returns 500 when the database read fails", async () => {
    tracksMock.mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
