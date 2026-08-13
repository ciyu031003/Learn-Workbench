import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 13, 10, 0, 0)); // 2026-08-13 local
  currentUserIdMock.mockResolvedValue("u-1");
});

afterEach(() => vi.useRealTimers());

describe("GET /api/focus/daily", () => {
  it("computes today stats, streak and last14", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ cnt: 2, total_seconds: 3000 }] } as never) // today
      .mockResolvedValueOnce({ rows: [
        { d: "2026-08-13", cnt: 2, secs: 3000 },
        { d: "2026-08-12", cnt: 1, secs: 1800 },
        { d: "2026-08-11", cnt: 1, secs: 1800 },
      ] } as never) // days
      .mockResolvedValueOnce({ rows: [{ start_time: "09:00", end_time: "09:25", minutes: 25 }] } as never); // todayList
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      date: "2026-08-13",
      todaySessions: 2,
      todayMinutes: 50,
      totalFocusDays: 3,
      streak: 3,
    });
    expect(json.last14).toHaveLength(14);
    expect(json.last14[13]).toEqual({ date: "2026-08-13", minutes: 50, sessions: 2 });
    expect(json.todayList).toEqual([{ start_time: "09:00", end_time: "09:25", minutes: 25 }]);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("'Asia/Shanghai'"), ["u-1", "2026-08-13"]);
  });

  it("counts streak from yesterday when today has no session", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ cnt: 0, total_seconds: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [
        { d: "2026-08-12", cnt: 1, secs: 600 },
        { d: "2026-08-11", cnt: 1, secs: 600 },
      ] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const json = await (await GET()).json();
    expect(json.streak).toBe(2);
    expect(json.todaySessions).toBe(0);
  });
});
