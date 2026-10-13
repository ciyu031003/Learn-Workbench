import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning-scheduler", () => ({
  learningSchedulerStatus: vi.fn(),
  setLearningSchedulerMode: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { currentUserId } from "@/lib/session";
import { learningSchedulerStatus, setLearningSchedulerMode } from "@/lib/learning-scheduler";
import { GET, PATCH } from "./route";

const userMock = vi.mocked(currentUserId);
const statusMock = vi.mocked(learningSchedulerStatus);
const setModeMock = vi.mocked(setLearningSchedulerMode);

const statusResponse = {
  mode: "shadow" as const,
  modeSource: "default" as const,
  trackSlug: "python",
  evaluation: {
    algorithmVersion: "ts-fsrs@5.4.2/fsrs-v6",
    source: "replayed_attempts" as const,
    generatedAt: "2026-10-13T00:00:00.000Z",
    sampleCount: 0,
    shadowedCount: 0,
    coverage: 0,
    meanAbsoluteDueDayDiff: null,
    p90AbsoluteDueDayDiff: null,
    horizons: [],
    stateCounts: { new: 0, learning: 0, review: 0, relearning: 0 },
  },
};

beforeEach(() => vi.clearAllMocks());

function getReq(url = "http://localhost/api/learning/scheduler?track=python") {
  return new Request(url);
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/learning/scheduler", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/learning/scheduler", () => {
  it("returns 401 when logged out", async () => {
    userMock.mockResolvedValue(null);
    expect((await GET(getReq())).status).toBe(401);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid track slug", async () => {
    userMock.mockResolvedValue("u-1");
    const response = await GET(getReq(`http://localhost/api/learning/scheduler?track=${"x".repeat(81)}`));
    expect(response.status).toBe(400);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("returns the scheduler evaluation for the requested track", async () => {
    userMock.mockResolvedValue("u-1");
    statusMock.mockResolvedValue(statusResponse);
    const response = await GET(getReq());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "shadow", trackSlug: "python" });
    expect(statusMock).toHaveBeenCalledWith("u-1", "python");
  });
});

describe("PATCH /api/learning/scheduler", () => {
  it("rejects invalid input", async () => {
    userMock.mockResolvedValue("u-1");
    const response = await PATCH(patchReq({ action: "take_over", trackSlug: "python" }));
    expect(response.status).toBe(400);
    expect(setModeMock).not.toHaveBeenCalled();
  });

  it("sets the idempotent shadow mode target", async () => {
    userMock.mockResolvedValue("u-1");
    setModeMock.mockResolvedValue({ ...statusResponse, mode: "off", modeSource: "default" });
    const response = await PATCH(patchReq({ action: "disable_shadow", trackSlug: "python" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "off" });
    expect(setModeMock).toHaveBeenCalledWith("u-1", { action: "disable_shadow", trackSlug: "python" });
  });
});
