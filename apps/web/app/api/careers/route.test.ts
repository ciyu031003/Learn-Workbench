import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET } from "./route";

const queryMock = vi.mocked(pgPool.query);
const uidMock = vi.mocked(currentUserId);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/careers", () => {
  it("returns system + owned domains for a logged-in user, excluding archived", async () => {
    uidMock.mockResolvedValue("u-1");
    const rows = [
      { career_key: "ict", name: "ICT", description: null, is_locked: false, sort_order: 0,
        owner_id: null, kind: "career", icon: "cpu", color: "#4f46e5", phase_prefix: "P", is_archived: false },
      { career_key: "badminton", name: "羽毛球", description: null, is_locked: false, sort_order: 9,
        owner_id: "u-1", kind: "sports", icon: "activity", color: "#ea580c", phase_prefix: "S", is_archived: false },
    ];
    queryMock.mockResolvedValue({ rows } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ careers: rows });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("is_archived = FALSE"),
      ["u-1"]
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("owner_id IS NULL OR owner_id = $1"),
      ["u-1"]
    );
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY sort_order, id"), ["u-1"]);
  });

  it("passes null for anonymous users (system-only scope)", async () => {
    uidMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("owner_id IS NULL OR owner_id = $1"), [null]);
  });
});
