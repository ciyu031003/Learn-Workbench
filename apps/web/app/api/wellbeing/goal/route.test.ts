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

describe("GET /api/wellbeing/goal", () => {
  it("returns default goal when none", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).goal).toEqual({ id: 0, targetMl: 2000 });
  });

  it("returns existing goal", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 3, targetMl: 2500 }] } as never);
    const res = await GET();
    expect((await res.json()).goal).toEqual({ id: 3, targetMl: 2500 });
  });
});

describe("PUT /api/wellbeing/goal", () => {
  it("rejects invalid target", async () => {
    const res = await PUT(jsonReq({ targetMl: 100 }));
    expect(res.status).toBe(400);
  });

  it("updates an existing goal", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 5 }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 5, targetMl: 3000 }] } as never);
    const res = await PUT(jsonReq({ targetMl: 3000 }));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[1][0])).toContain("UPDATE hydration_goals");
  });

  it("inserts for a logged-in user when none exists", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 9, targetMl: 2500 }] } as never);
    const res = await PUT(jsonReq({ targetMl: 2500 }));
    expect(res.status).toBe(200);
    const [sql, args] = queryMock.mock.calls[1] as unknown[];
    expect(String(sql)).toContain("INSERT INTO hydration_goals");
    expect(args).toEqual(["u-1", 2500, "2026-08-29"]);
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 2, targetMl: 1800 }] } as never);
    const res = await PUT(jsonReq({ targetMl: 1800 }));
    expect(res.status).toBe(200);
    const [sql, args] = queryMock.mock.calls[1] as unknown[];
    expect(String(sql)).toContain("anon_id");
    expect(args).toEqual(["anon-1", 1800, "2026-08-29"]);
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
