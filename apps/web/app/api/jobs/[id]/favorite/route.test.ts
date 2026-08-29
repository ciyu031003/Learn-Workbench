import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { currentUserId } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const queryMock = vi.mocked(pgPool.query);
const ctx = { params: Promise.resolve({ id: "1" }) };

beforeEach(() => vi.resetAllMocks());

describe("POST /api/jobs/[id]/favorite", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "0" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when job does not exist", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(404);
  });

  it("unfavorites when already favorited", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] } as never);      // job exists
    queryMock.mockResolvedValueOnce({ rows: [{ user_id: "u-1" }] } as never); // has favorite
    queryMock.mockResolvedValueOnce({ rowCount: 1 } as never);           // delete
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ favorited: false });
    expect(String(queryMock.mock.calls[2][0])).toContain("DELETE FROM job_favorites");
  });

  it("favorites when not yet favorited", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }] } as never);      // job exists
    queryMock.mockResolvedValueOnce({ rows: [] } as never);               // no favorite
    queryMock.mockResolvedValueOnce({ rows: [] } as never);               // insert
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ favorited: true });
    expect(String(queryMock.mock.calls[2][0])).toContain("INSERT INTO job_favorites");
  });
});
