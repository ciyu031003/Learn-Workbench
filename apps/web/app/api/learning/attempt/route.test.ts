import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/learning", () => ({ recordLearningAttempt: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { recordLearningAttempt } from "@/lib/learning";
import { POST } from "./route";

const userMock = vi.mocked(currentUserId);
const recordMock = vi.mocked(recordLearningAttempt);

beforeEach(() => vi.clearAllMocks());

function req(body: unknown): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/learning/attempt", () => {
  it("returns 401 when logged out", async () => {
    userMock.mockResolvedValue(null);
    expect((await POST(req({}))).status).toBe(401);
  });

  it("rejects invalid input", async () => {
    userMock.mockResolvedValue("u-1");
    expect((await POST(req({ trackSlug: "python" }))).status).toBe(400);
  });

  it("records an attempt", async () => {
    userMock.mockResolvedValue("u-1");
    recordMock.mockResolvedValue({
      questionKey: "py-q1",
      trackSlug: "python",
      stageKey: "python-foundation",
      isCorrect: true,
      answer: ["B"],
      explanation: "布尔值语义最清晰。",
      createdAt: "2026-10-09T00:00:00.000Z",
    });
    const res = await POST(
      req({
        questionKey: "py-q1",
        trackSlug: "python",
        stageKey: "python-foundation",
        chosenAnswer: ["B"],
      })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).isCorrect).toBe(true);
  });
});

