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

describe("POST /api/trackers/logs", () => {
  it("requires login", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/trackers/logs", { method: "POST", body: JSON.stringify({ trackerId: 1, logDate: "2026-09-03", value: 30 }) }));
    expect(res.status).toBe(401);
  });

  it("validates the date format", async () => {
    const res = await POST(new Request("http://localhost/api/trackers/logs", { method: "POST", body: JSON.stringify({ trackerId: 1, logDate: "bad", value: 1 }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "日期格式无效" });
  });

  it("rejects trackers that are not owned", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await POST(new Request("http://localhost/api/trackers/logs", { method: "POST", body: JSON.stringify({ trackerId: 1, logDate: "2026-09-03", value: 30 }) }));
    expect(res.status).toBe(404);
  });

  it("upserts a log for the day", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 8, tracker_id: 1, log_date: "2026-09-03", value: 30, note: null }] } as never);
    const res = await POST(new Request("http://localhost/api/trackers/logs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackerId: 1, logDate: "2026-09-03", value: 30 }),
    }));
    expect(res.status).toBe(201);
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO tracker_logs"),
      ["u-1", 1, "2026-09-03", 30, null]
    );
  });
});
