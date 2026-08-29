import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
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

describe("GET /api/wellbeing/energy", () => {
  it("clamps limit and returns logs", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/wellbeing/energy?limit=999"));
    expect(res.status).toBe(200);
    expect((await res.json()).logs).toEqual([]);
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", 50]);
  });
});

describe("POST /api/wellbeing/energy", () => {
  it("rejects an out-of-range level", async () => {
    const res = await POST(jsonReq({ level: 6 }));
    expect(res.status).toBe(400);
  });

  it("inserts for logged-in user with default source", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, level: 3, note: null, source: "MANUAL", recordedAt: "x" }] } as never);
    const res = await POST(jsonReq({ level: 3, source: "BAD" }));
    expect(res.status).toBe(201);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("INSERT INTO energy_logs");
    expect(args).toEqual(["u-1", 3, null, "MANUAL"]);
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [{ id: 1, level: 5, note: null, source: "MORNING", recordedAt: "x" }] } as never);
    const res = await POST(jsonReq({ level: 5, source: "MORNING" }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
