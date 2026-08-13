import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("POST /api/checkin", () => {
  it("upserts a checkin for today with the note", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await POST(
      new Request("http://localhost/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: " 打卡！ " }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO checkins"),
      ["u-1", "打卡！"]
    );
  });

  it("handles a missing note as null", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await POST(new Request("http://localhost/api/checkin", { method: "POST", body: "not-json" }));
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["u-1", null]);
  });
});
