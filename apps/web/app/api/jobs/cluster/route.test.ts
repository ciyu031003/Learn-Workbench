import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/job-clusters", () => ({ runJobClustering: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { runJobClustering } from "@/lib/job-clusters";
import { logger } from "@/lib/logger";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const runMock = vi.mocked(runJobClustering);
const errorMock = vi.mocked(logger.error);
beforeEach(() => vi.clearAllMocks());

describe("POST /api/jobs/cluster", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("runs clustering and returns ok", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    runMock.mockResolvedValue({ clustered: 2 } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.clustered).toBe(2);
    expect(runMock).toHaveBeenCalledWith(7);
  });

  it("returns 500 on error", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    runMock.mockRejectedValue(new Error("boom"));
    const res = await POST();
    expect(res.status).toBe(500);
    expect(errorMock).toHaveBeenCalled();
  });
});
