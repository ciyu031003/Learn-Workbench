import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@learn-workbench/shared", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, todayISO: vi.fn(() => "2026-08-29") };
});
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/wellbeing/hydration", () => {
  it("returns logs with total and default goal", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, amountMl: 250, source: "MANUAL", recordedAt: "x" }] } as never);
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/wellbeing/hydration?date=2026-08-29"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalMl).toBe(250);
    expect(body.targetMl).toBe(2000);
  });
});

describe("POST /api/wellbeing/hydration", () => {
  it("rejects invalid amount", async () => {
    const res = await POST(jsonReq({ amountMl: 0 }));
    expect(res.status).toBe(400);
  });

  it("inserts for logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, amountMl: 300, source: "MANUAL", recordedAt: "x" }] } as never);
    const res = await POST(jsonReq({ amountMl: 300, source: "BAD" }));
    expect(res.status).toBe(201);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("INSERT INTO hydration_logs");
    expect(args).toEqual(["u-1", 300, "MANUAL"]);
  });

  it("inserts with anon id", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [{ id: 1, amountMl: 500, source: "REMINDER", recordedAt: "x" }] } as never);
    const res = await POST(jsonReq({ amountMl: 500, source: "REMINDER" }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
