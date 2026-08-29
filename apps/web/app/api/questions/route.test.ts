import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/interview", () => ({
  listQuestions: vi.fn(),
  listQuestionModules: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { listQuestions, listQuestionModules } from "@/lib/interview";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const listMock = vi.mocked(listQuestions);
const modulesMock = vi.mocked(listQuestionModules);
const errorMock = vi.mocked(logger.error);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/questions", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(401);
  });

  it("returns questions and modules", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    modulesMock.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(200);
    expect((await res.json()).questions).toEqual([]);
    expect(listMock).toHaveBeenCalledWith({ module: undefined, difficulty: undefined });
  });

  it("passes module / difficulty filters", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockResolvedValue([]);
    modulesMock.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost?module=Agent&difficulty=hard"));
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({ module: "Agent", difficulty: "hard" });
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    listMock.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
