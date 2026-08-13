import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET, PUT } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/settings/career", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/settings/career", () => {
  it("returns the default ict for anonymous users", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ career: "ict", set: false });
  });

  it("returns the saved career for logged-in users", async () => {
    queryMock.mockResolvedValue({ rows: [{ value: "ai-engineer" }] } as never);
    const res = await GET();
    expect(await res.json()).toEqual({ career: "ai-engineer", set: true });
  });
});

describe("PUT /api/settings/career", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await put({ career: "frontend" });
    expect(res.status).toBe(401);
  });

  it("rejects invalid careers", async () => {
    const res = await put({ career: "hacker" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "职业无效" });
  });

  it("upserts the career setting as jsonb", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await put({ career: "data-analysis" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, career: "data-analysis" });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (user_id, key)"),
      ["u-1", JSON.stringify("data-analysis")]
    );
  });
});
