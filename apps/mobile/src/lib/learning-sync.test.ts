import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningAttempt } from "./learning-progress";

const storage = vi.hoisted(() => ({ value: null as string | null }));
const state = vi.hoisted(() => ({ token: "tok" as string | null }));

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

import { flushLearningAttempts, syncLearningAttempt } from "./learning-sync";

const fetchMock = vi.fn();

function attempt(): LearningAttempt {
  return {
    clientId: "attempt-client-1",
    questionKey: "py-q1",
    trackSlug: "python",
    stageKey: "python-foundation",
    chosenAnswer: ["B"],
    isCorrect: true,
    createdAt: "2026-10-13T00:00:00.000Z",
  };
}

beforeEach(() => {
  storage.value = null;
  state.token = "tok";
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("learning attempt sync", () => {
  it("queues offline attempts and flushes them with the same clientId", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await syncLearningAttempt(attempt())).toBe(false);
    expect(storage.value).toContain("attempt-client-1");

    fetchMock.mockResolvedValueOnce({ ok: true });
    expect(await flushLearningAttempts()).toBe(1);
    expect(storage.value).toBe("[]");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: expect.stringContaining("\"clientId\":\"attempt-client-1\""),
    });
  });

  it("does not send when logged out", async () => {
    state.token = null;
    expect(await syncLearningAttempt(attempt())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
