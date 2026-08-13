import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { POST } from "./route";

const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("POST /api/focus", () => {
  it("returns 400 when startedAt is invalid", async () => {
    const res = await POST(
      new Request("http://localhost/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: "not-a-date" }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "startedAt 无效" });
  });

  it("inserts a session and bumps the task focus minutes", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 1, duration_seconds: 1500 }] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const res = await POST(
      new Request("http://localhost/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: "2026-08-13T09:00:00.000Z", endedAt: "2026-08-13T09:25:00.000Z", taskId: 5 }),
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ session: { id: 1, duration_seconds: 1500 } });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO focus_sessions"), [
      "u-1", 5, new Date("2026-08-13T09:00:00.000Z"), new Date("2026-08-13T09:25:00.000Z"), 1500,
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE daily_tasks SET focus_minutes"), [
      25, 5, "u-1",
    ]);
    expect(release).toHaveBeenCalled();
  });

  it("does not bump the task when duration is zero", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    connectMock.mockResolvedValue({ query, release: vi.fn() } as never);
    await POST(
      new Request("http://localhost/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: "2026-08-13T09:00:00.000Z", endedAt: "2026-08-13T09:00:00.000Z", taskId: 5 }),
      })
    );
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE daily_tasks"))).toBe(false);
  });
});
