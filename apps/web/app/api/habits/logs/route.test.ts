import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
vi.mock("@/lib/habits", () => ({ listLogs: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { listLogs } from "@/lib/habits";
import { GET, POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);
const listLogsMock = vi.mocked(listLogs);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
  listLogsMock.mockResolvedValue([]);
});

describe("GET /api/habits/logs", () => {
  it("requires valid date range", async () => {
    const res = await GET(new Request("http://localhost/api/habits/logs?from=2026-09-01&to=bad"));
    expect(res.status).toBe(400);
  });

  it("returns logs for a valid range", async () => {
    listLogsMock.mockResolvedValue([{ habitId: 1, logDate: "2026-09-14", value: 1 }]);
    const res = await GET(new Request("http://localhost/api/habits/logs?from=2026-09-01&to=2026-09-14"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
  });
});

describe("POST /api/habits/logs", () => {
  it("rejects invalid habitId", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { habitId: 0 } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("404 when the habit is not owned by the scope", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { habitId: 7, date: "2026-09-14" } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("upserts a check-in with default value 1", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { habitId: 7, date: "2026-09-14" } });
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 7 }] } as never)
      .mockResolvedValueOnce({ rows: [{ habitId: 7, logDate: "2026-09-14", value: 1, note: null }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const insert = queryMock.mock.calls[1];
    expect(String(insert[0])).toContain("ON CONFLICT (user_id, habit_id, log_date)");
    expect(insert[1]).toEqual(["u-1", 7, "2026-09-14", 1, null]);
  });

  it("accepts a quantitative value", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { habitId: 7, date: "2026-09-14", value: 5 } });
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 7 }] } as never)
      .mockResolvedValueOnce({ rows: [{ habitId: 7, logDate: "2026-09-14", value: 5, note: null }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    expect((queryMock.mock.calls[1][1] as unknown[])[3]).toBe(5);
  });
});

describe("DELETE /api/habits/logs", () => {
  it("rejects an invalid date", async () => {
    const res = await DELETE(new Request("http://localhost/api/habits/logs?habitId=1&date=x"));
    expect(res.status).toBe(400);
  });

  it("deletes the check-in", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/habits/logs?habitId=1&date=2026-09-14"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("DELETE FROM habit_logs");
  });
});