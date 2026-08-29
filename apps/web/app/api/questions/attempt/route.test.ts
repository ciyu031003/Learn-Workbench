import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/interview", () => ({ createAttempt: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { createAttempt } from "@/lib/interview";
import { logger } from "@/lib/logger";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const createMock = vi.mocked(createAttempt);
const errorMock = vi.mocked(logger.error);

beforeEach(() => vi.clearAllMocks());

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/questions/attempt", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(jsonReq({ questionId: 1, chosenAnswer: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ selfRating: 99 }));
    expect(res.status).toBe(400);
  });

  it("creates an attempt and returns correctness + answer", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    createMock.mockResolvedValue({
      attempt: { id: 1, questionId: 1 } as never,
      isCorrect: true,
      answer: "参考答案",
    });
    const res = await POST(jsonReq({ questionId: 1, chosenAnswer: "x", mode: "quiz" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.isCorrect).toBe(true);
    expect(data.answer).toBe("参考答案");
    expect(createMock).toHaveBeenCalledWith("u-1", expect.objectContaining({ questionId: 1 }));
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    createMock.mockRejectedValue(new Error("boom"));
    const res = await POST(jsonReq({ questionId: 1, chosenAnswer: "x" }));
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
