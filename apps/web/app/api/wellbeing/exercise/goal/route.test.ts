import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@learn-workbench/shared", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, todayISO: vi.fn(() => "2026-08-29") };
});
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET, PUT } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/wellbeing/exercise/goal", () => {
  it("returns default 30 when no goal row", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).targetMinutes).toBe(30);
  });
});

describe("PUT /api/wellbeing/exercise/goal", () => {
  it("rejects out-of-range target", async () => {
    const res = await PUT(jsonReq({ targetMinutes: 0 }));
    expect(res.status).toBe(400);
  });

  it("updates existing goal for the day", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 5 }] } as never);   // existing
    queryMock.mockResolvedValueOnce({ rows: [{ id: 5, targetMinutes: 60 }] } as never); // update
    const res = await PUT(jsonReq({ targetMinutes: 60 }));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[1][0])).toContain("UPDATE exercise_goals");
  });

  it("inserts new goal for anon user", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);   // no existing
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, targetMinutes: 20 }] } as never); // insert
    const res = await PUT(jsonReq({ targetMinutes: 20 }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[1][0])).toContain("anon_id");
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}