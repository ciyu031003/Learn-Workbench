import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDueReviewKeys, fetchLearningReview } from "./learning-review";

const state = vi.hoisted(() => ({ token: "tok" as string | null }));

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => state },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  state.token = "tok";
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("fetchLearningReview", () => {
  it("returns null when logged out (no token)", async () => {
    state.token = null;
    expect(await fetchLearningReview()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes the server payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ cards: [{ questionKey: "a" }], dueCount: 1, totalCount: 3, masteredCount: 1 }),
    });
    const review = await fetchLearningReview();
    expect(review).toMatchObject({ dueCount: 1, totalCount: 3, masteredCount: 1 });
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/learning/review", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer tok" }),
    }));
  });

  it("returns null on network failure (caller falls back to local wrong answers)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await fetchLearningReview()).toBeNull();
  });

  it("filters due keys by track", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        cards: [
          { questionKey: "py-1", trackSlug: "python" },
          { questionKey: "java-1", trackSlug: "java" },
        ],
        dueCount: 2,
        totalCount: 2,
        masteredCount: 0,
      }),
    });
    expect(await fetchDueReviewKeys("python")).toEqual(["py-1"]);
    expect(await fetchDueReviewKeys()).toEqual(["py-1", "java-1"]);
  });
});
