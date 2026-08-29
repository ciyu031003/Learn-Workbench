import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const queryMock = vi.mocked(pgPool.query);
beforeEach(() => vi.resetAllMocks());

describe("GET /api/jobs/runs", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("maps rows to runs", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({
      rows: [{ id: 1, started_at: "2026-08-01T00:00:00Z", finished_at: null, status: "running", platforms_result: { lagou: 5 }, fetched_count: 5, new_count: 2, error: null }],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs[0]).toMatchObject({ id: 1, status: "running", platformsResult: { lagou: 5 }, fetchedCount: 5 });
  });
});
