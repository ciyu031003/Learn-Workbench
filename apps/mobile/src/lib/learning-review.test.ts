import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLearningReviewAction, fetchDueReviewKeys, fetchLearningReview, reviewMasteryLabel, reviewMasteryLevel } from "./learning-review";

const state = vi.hoisted(() => ({ token: "tok" as string | null }));
const storage = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => state },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => storage.value),
    setItem: vi.fn(async (_key: string, value: string) => {
      storage.value = value;
    }),
  },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  state.token = "tok";
  storage.value = null;
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
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/learning/review?scope=due", expect.objectContaining({
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

  it("queues review actions offline with a stable clientId", async () => {
    state.token = null;
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await applyLearningReviewAction({
      action: "snooze",
      questionKeys: ["py-1", "py-1"],
      snoozeDays: 1,
    });
    expect(result.queued).toBe(true);
    expect(storage.value).toContain("snooze");
    expect(storage.value).toContain("py-1");
  });
});

describe("reviewMasteryLevel", () => {
  it("marks mastered cards as stable (5)", () => {
    expect(reviewMasteryLevel({ status: "mastered", streak: 0, lapses: 3 })).toBe(5);
    expect(reviewMasteryLabel(5)).toBe("稳定");
  });

  it("caps learning cards at 2 and review cards at 4", () => {
    expect(reviewMasteryLevel({ status: "learning", streak: 6, lapses: 0 })).toBe(2);
    expect(reviewMasteryLevel({ status: "review", streak: 9, lapses: 0 })).toBe(4);
  });

  it("does not award the review bonus after a lapse", () => {
    expect(reviewMasteryLevel({ status: "review", streak: 1, lapses: 2 })).toBe(1);
    expect(reviewMasteryLevel({ status: "review", streak: 1, lapses: 0 })).toBe(2);
  });

  it("keeps suspended cards below mastered", () => {
    expect(reviewMasteryLevel({ status: "suspended", streak: 5, lapses: 0 })).toBe(4);
    expect(reviewMasteryLabel(0)).toBe("未开始");
  });
});
