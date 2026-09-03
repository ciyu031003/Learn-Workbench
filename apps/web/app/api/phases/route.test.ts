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
  it("defaults to ict for anonymous users and only returns system phases", async () => {
    currentUserIdMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/phases"));
    expect((await res.json()).career).toBe("ict");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE career_key = $1"),
      ["ict", null]
    );
  });

  it("honours an explicit career param", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 2, phase_key: "e1", title: "E1", track: "main" }] } as never);
    const res = await GET(new Request("http://localhost/api/phases?career=english"));
    const json = await res.json();
    expect(json.career).toBe("english");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE career_key = $1"),
      ["english", "u-1"]
    );
  });

  it("uses the user saved career setting and filters owner scope", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ value: "frontend" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 1, phase_key: "f1", title: "F1", track: "main" }] } as never);
    const res = await GET(new Request("http://localhost/api/phases"));
    const json = await res.json();
    expect(json.career).toBe("frontend");
    expect(json.phases).toEqual([{ id: 1, phase_key: "f1", title: "F1", track: "main" }]);
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("key = $2"),
      ["u-1", "career"]
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("(is_custom = FALSE OR owner_id = $2)"),
      ["frontend", "u-1"]
    );
  });
});
