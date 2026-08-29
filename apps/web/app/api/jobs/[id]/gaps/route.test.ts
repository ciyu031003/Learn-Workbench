import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/skills", () => ({ computeSkillGaps: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { computeSkillGaps } from "@/lib/skills";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const gapsMock = vi.mocked(computeSkillGaps);
const errorMock = vi.mocked(logger.error);
const ctx = { params: Promise.resolve({ id: "1" }) };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/[id]/gaps", () => {
  it("returns 400 for invalid id before auth", async () => {
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "xx" }) });
    expect(res.status).toBe(400);
  });

  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns gaps on success", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    gapsMock.mockResolvedValue({ gaps: [] } as never);
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect(gapsMock).toHaveBeenCalledWith("u-1", 1);
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    gapsMock.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
