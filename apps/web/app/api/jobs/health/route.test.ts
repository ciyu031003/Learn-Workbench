import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ sourceHealth: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { sourceHealth } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const healthMock = vi.mocked(sourceHealth);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/health", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/health"));
    expect(res.status).toBe(401);
  });

  it("passes source and clamped limit", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    healthMock.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/jobs/health?source=lagou&limit=999"));
    expect(res.status).toBe(200);
    expect(healthMock).toHaveBeenCalledWith("lagou", 60);
    expect((await res.json()).history).toEqual([]);
  });

  it("passes undefined source when absent", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    healthMock.mockResolvedValue([]);
    await GET(new Request("http://localhost/api/jobs/health?limit=5"));
    expect(healthMock).toHaveBeenCalledWith(undefined, 5);
  });
});
