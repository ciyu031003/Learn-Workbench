import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/skills", () => ({ computeJobMatch: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { computeJobMatch } from "@/lib/skills";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const matchMock = vi.mocked(computeJobMatch);
const errorMock = vi.mocked(logger.error);
const ctx = { params: Promise.resolve({ id: "7" }) };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/[id]/match", () => {
  it("returns 400 for invalid id", async () => {
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns match on success (even when logged out)", async () => {
    currentUserIdMock.mockResolvedValue(null);
    matchMock.mockResolvedValue({ score: 80 } as never);
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).match).toEqual({ score: 80 });
    expect(matchMock).toHaveBeenCalledWith(null, 7);
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    matchMock.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
