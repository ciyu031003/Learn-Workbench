import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("PATCH /api/workouts/[id]", () => {
  it("replaces items when provided", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "腿部", items: [{ exerciseLabel: "深蹲", sets: 5, reps: 5, weightKg: 80 }] } });
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })          // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // SELECT own
      .mockResolvedValueOnce({ rows: [] })          // UPDATE workouts
      .mockResolvedValueOnce({ rows: [] })          // DELETE items
      .mockResolvedValueOnce({ rows: [] })          // INSERT item
      .mockResolvedValueOnce({ rows: [] });         // COMMIT
    connectMock.mockResolvedValue({ query, release: vi.fn() } as never);

    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("5"));
    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM workout_items"), ["u-1", 5]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO workout_items"), [
      "u-1", 5, null, "深蹲", 5, 5, 80, 0, 0,
    ]);
  });

  it("404 when the workout is not owned", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "x" } });
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // SELECT own → none
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    connectMock.mockResolvedValue({ query, release: vi.fn() } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("9"));
    expect(res.status).toBe(404);
  });

  it("rejects when nothing to update", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: {} });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("5"));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid date", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { exercisedOn: "14/09/2026" } });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("5"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/workouts/[id]", () => {
  it("soft-deletes", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("5"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at = now()");
  });

  it("rejects an invalid id", async () => {
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("x"));
    expect(res.status).toBe(400);
  });
});