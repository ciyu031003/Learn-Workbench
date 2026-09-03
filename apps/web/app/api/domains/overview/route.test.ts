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

describe("GET /api/domains/overview", () => {
  it("returns zero when there are no trackers", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: "0" }] } as never);
    const res = await GET(new Request("http://localhost/api/domains/overview?career=english"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ career: "english", trackerCount: 0, todayCount: 0, todayValue: 0 });
  });

  it("sums today logs when trackers exist", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: "2" }] } as never)
      .mockResolvedValueOnce({ rows: [{ n: "2", s: "45" }] } as never);
    const res = await GET(new Request("http://localhost/api/domains/overview?career=english"));
    const json = await res.json();
    expect(json).toMatchObject({ career: "english", trackerCount: 2, todayCount: 2, todayValue: 45 });
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("SUM(l.value)"), ["u-1", "english", expect.any(String)]);
  });
});
