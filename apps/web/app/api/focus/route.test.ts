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

  it("幂等续写（client_id）：非结算请求只 upsert 不累加任务分钟", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 9, duration_seconds: 120, focus_minutes_applied: false }] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const res = await POST(
      new Request("http://localhost/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "c-abc",
          started_at: "2026-08-13T09:00:00.000Z",
          ended_at: "2026-08-13T09:02:00.000Z",
          task_id: 5,
          duration_seconds: 120,
        }),
      })
    );
    expect(res.status).toBe(201);
    expect(String(query.mock.calls[0][0])).toContain("ON CONFLICT");
    // 未带 settle → 不累加 daily_tasks
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE daily_tasks"))).toBe(false);
    expect(release).toHaveBeenCalled();
  });

  it("幂等续写 + settle：最终结算才累加任务分钟一次", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 9, duration_seconds: 130, focus_minutes_applied: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const res = await POST(
      new Request("http://localhost/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "c-abc",
          started_at: "2026-08-13T09:00:00.000Z",
          ended_at: "2026-08-13T09:02:10.000Z",
          task_id: 5,
          duration_seconds: 130,
          settle: true,
        }),
      })
    );
    expect(res.status).toBe(201);
    // 置位 focus_minutes_applied + 累加 daily_tasks
    expect(query.mock.calls[1][0]).toContain("focus_minutes_applied = true");
    expect(query.mock.calls[2][0]).toContain("UPDATE daily_tasks SET focus_minutes");
    expect(query.mock.calls[2][1]).toEqual([2, 5, "u-1"]);
  });

  it("显式 duration_seconds 被钳制到单会话上限", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 1, duration_seconds: 12 * 3600 }] });
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);
    const res = await POST(
      new Request("http://localhost/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "c-big",
          started_at: "2026-08-13T09:00:00.000Z",
          duration_seconds: 999999,
        }),
      })
    );
    expect(res.status).toBe(201);
    // 参数最后一个值应被钳制为 MAX（12h）
    const args = query.mock.calls[0][1] as unknown[];
    expect(args[4]).toBe(12 * 3600);
  });
});
