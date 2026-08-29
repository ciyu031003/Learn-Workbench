import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({
  userScope: vi.fn(),
  scopeWhere: vi.fn(),
  anonFilterSql: vi.fn(),
}));
vi.mock("@/lib/wellbeing", () => ({ computeNextTriggerMs: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere, anonFilterSql } from "@/lib/anon";
import { computeNextTriggerMs } from "@/lib/wellbeing";
import { GET, POST, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const anonFilterMock = vi.mocked(anonFilterSql);
const nextTriggerMock = vi.mocked(computeNextTriggerMs);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  anonFilterMock.mockImplementation((i) => `(anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $${i})`);
  nextTriggerMock.mockReturnValue(Date.parse("2026-08-29T10:00:00Z"));
});

describe("GET /api/wellbeing/reminders", () => {
  it("returns reminders", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).reminders).toEqual([]);
  });
});

describe("POST /api/wellbeing/reminders", () => {
  it("returns 400 when title is empty", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    const res = await POST(jsonReq({ title: "  " }));
    expect(res.status).toBe(400);
  });

  it("inserts with defaults for a logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, type: "CUSTOM", title: "喝水", message: null, enabled: false, intervalMinutes: 60, startTime: "09:00", endTime: "22:00", weekdays: [1, 2, 3, 4, 5, 6, 7], nextTriggerAt: "2026-08-29T10:00:00.000Z" }] } as never);
    const res = await POST(jsonReq({ title: "喝水", type: "BAD" }));
    expect(res.status).toBe(201);
    const [sql, rawArgs] = queryMock.mock.calls[0] as unknown[];
    const args = rawArgs as unknown[];
    expect(String(sql)).toContain("INSERT INTO wellbeing_reminders");
    expect(args[0]).toBe("u-1");
    expect(args[1]).toBe("CUSTOM");
    expect(nextTriggerMock).toHaveBeenCalled();
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [{ id: 1, type: "HYDRATION", title: "喝水", message: null, enabled: false, intervalMinutes: 60, startTime: "09:00", endTime: "22:00", weekdays: [1], nextTriggerAt: "x" }] } as never);
    const res = await POST(jsonReq({ title: "喝水", type: "HYDRATION", weekdays: [1], intervalMinutes: 90 }));
    expect(res.status).toBe(201);
    const [sql, rawArgs] = queryMock.mock.calls[0] as unknown[];
    const args = rawArgs as unknown[];
    expect(String(sql)).toContain("anon_id");
    expect(args[0]).toBe("anon-1");
    expect(args[4]).toBe(90);
  });
});

describe("PATCH /api/wellbeing/reminders", () => {
  it("returns 400 for invalid id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    const res = await PATCH(jsonReq({ id: "abc", enabled: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no fields are provided", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    const res = await PATCH(jsonReq({ id: 1 }));
    expect(res.status).toBe(400);
  });

  it("recomputes next trigger and updates when the row exists", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ intervalMinutes: 60, startTime: "09:00", endTime: "22:00", weekdays: [1, 2, 3, 4, 5] }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, type: "HYDRATION", title: "喝水", message: null, enabled: true, intervalMinutes: 60, startTime: "09:00", endTime: "22:00", weekdays: [1, 2, 3, 4, 5], nextTriggerAt: "x" }] } as never);
    const res = await PATCH(jsonReq({ id: 1, enabled: true }));
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(String(queryMock.mock.calls[1][0])).toContain("UPDATE wellbeing_reminders");
  });

  it("updates without recompute when the row is missing", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await PATCH(jsonReq({ id: 1, enabled: true }));
    expect(res.status).toBe(200);
    expect(nextTriggerMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/wellbeing/reminders", () => {
  it("returns 400 for invalid id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    const res = await DELETE(new Request("http://localhost/api/wellbeing/reminders?id=abc"));
    expect(res.status).toBe(400);
  });

  it("soft-deletes for a logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/wellbeing/reminders?id=5"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at = now()");
  });

  it("adds anon scope when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/wellbeing/reminders?id=5"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id IS NULL");
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}


