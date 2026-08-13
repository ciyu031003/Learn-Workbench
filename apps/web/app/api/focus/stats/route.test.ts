import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/focus/stats", () => {
  it("maps rows into phase stats with minutes", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { phase_id: 1, phase_title: "P1", total_seconds: 3600, session_count: 2 },
        { phase_id: null, phase_title: null, total_seconds: 90, session_count: 1 },
      ],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      stats: [
        { phaseId: 1, phaseTitle: "P1", totalMinutes: 60, sessionCount: 2 },
        { phaseId: null, phaseTitle: "未分类", totalMinutes: 2, sessionCount: 1 },
      ],
    });
  });
});
