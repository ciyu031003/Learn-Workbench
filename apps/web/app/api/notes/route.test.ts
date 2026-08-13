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

describe("GET /api/notes", () => {
  it("clamps limit and returns tagged notes", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1, title: "n", tags: [] }] } as never);
    const res = await GET(new Request("http://localhost/api/notes?limit=999"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notes: [{ id: 1, title: "n", tags: [] }] });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("GROUP BY n.id"), ["u-1", 200]);
  });
});
