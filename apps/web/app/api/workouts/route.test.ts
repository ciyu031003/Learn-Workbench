import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, POST, normalizeItems } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("normalizeItems", () => {
  it("drops entries without a label and clamps numbers", () => {
    const out = normalizeItems([
      { exerciseLabel: "卧推", sets: 999, reps: -5, weightKg: 60.55 },
      { exerciseLabel: "  " },
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sets).toBe(200);
    expect(out[0].reps).toBe(0); // 负数钳位到 0
    expect(out[0].weightKg).toBe(60.6);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeItems(undefined)).toEqual([]);
  });
});

describe("GET /api/workouts", () => {
  it("returns workouts with items and totals", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: "1", name: "胸+三头", exercisedOn: "2026-09-14", durationSeconds: 2700, note: null, updatedAt: "x" }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: "11", workoutId: "1", exerciseKey: "bench", exerciseLabel: "卧推", sets: 4, reps: 8, weightKg: "60", durationSeconds: 0, sortOrder: 0 },
        ],
      } as never);
    const res = await GET(new Request("http://localhost/api/workouts?days=7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workouts).toHaveLength(1);
    expect(body.workouts[0].items[0].exerciseLabel).toBe("卧推");
    // 4 组 × 8 次 × 60kg = 1920
    expect(body.totals.volumeKg).toBe(1920);
  });

  it("returns empty result without a second query when no workouts", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/workouts"));
    const body = await res.json();
    expect(body.workouts).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/workouts", () => {
  it("inserts a workout with its items in a transaction", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { name: "胸+三头", exercisedOn: "2026-09-14", durationSeconds: 2700, items: [{ exerciseLabel: "卧推", sets: 4, reps: 8, weightKg: 60 }] },
    });
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })   // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })   // INSERT workouts
      .mockResolvedValueOnce({ rows: [] })            // INSERT workout_items
      .mockResolvedValueOnce({ rows: [] });           // COMMIT
    const release = vi.fn();
    connectMock.mockResolvedValue({ query, release } as never);

    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workout.id).toBe(5);
    expect(query).toHaveBeenCalledWith("BEGIN");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO workouts"), [
      "u-1", "胸+三头", "2026-09-14", 2700, null, null,
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO workout_items"), [
      "u-1", 5, null, "卧推", 4, 8, 60, 0, 0,
    ]);
    expect(release).toHaveBeenCalled();
  });

  it("rolls back when an insert fails", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "t", items: [] } });
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockRejectedValueOnce(new Error("boom"))            // INSERT workouts 失败
      .mockResolvedValueOnce({ rows: [] });                // ROLLBACK
    connectMock.mockResolvedValue({ query, release: vi.fn() } as never);
    await expect(POST(new Request("http://localhost", { method: "POST" }))).rejects.toThrow("boom");
    expect(query).toHaveBeenCalledWith("ROLLBACK");
  });
});