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

describe("GET /api/phases", () => {
  it("defaults to ict for anonymous users", async () => {
    currentUserIdMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    expect((await res.json()).career).toBe("ict");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE career_key = $1"),
      ["ict"]
    );
  });

  it("uses the user's saved career setting", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ value: "frontend" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 1, phase_key: "f1", title: "F1", track: "main" }] } as never);
    const res = await GET();
    const json = await res.json();
    expect(json.career).toBe("frontend");
    expect(json.phases).toEqual([{ id: 1, phase_key: "f1", title: "F1", track: "main" }]);
  });
});
