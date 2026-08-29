import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/skills", () => ({ enrollGapsToTasks: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { enrollGapsToTasks } from "@/lib/skills";
import { logger } from "@/lib/logger";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const enrollMock = vi.mocked(enrollGapsToTasks);
const errorMock = vi.mocked(logger.error);
beforeEach(() => vi.clearAllMocks());

describe("POST /api/jobs/gaps/enroll", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when gaps is empty", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(jsonReq({ gaps: [] }));
    expect(res.status).toBe(400);
  });

  it("maps gaps and returns created", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    enrollMock.mockResolvedValue([{ id: 1 }] as never);
    const res = await POST(jsonReq({ gaps: [{ skill: "Go", topicId: 2, hours: 12 }] }));
    expect(res.status).toBe(200);
    expect(enrollMock).toHaveBeenCalledWith("u-1", [{ skill: "Go", topicId: 2, hours: 12 }]);
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    enrollMock.mockRejectedValue(new Error("boom"));
    const res = await POST(jsonReq({ gaps: [{ skill: "Go" }] }));
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
