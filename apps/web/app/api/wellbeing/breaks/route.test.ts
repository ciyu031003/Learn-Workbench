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

describe("GET /api/wellbeing/breaks", () => {
  it("returns breaks for a date", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, kind: "SHORT", minutes: 5, note: null, startedAt: "2026-08-29T00:00:00Z" }] } as never);
    const res = await GET(new Request("http://localhost/api/wellbeing/breaks?date=2026-08-29"));
    expect(res.status).toBe(200);
    expect((await res.json()).breaks).toHaveLength(1);
    expect(queryMock).toHaveBeenCalled();
  });
});

describe("POST /api/wellbeing/breaks", () => {
  it("inserts for a logged-in user and clamps minutes", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, kind: "SHORT", minutes: 5, note: null, startedAt: "x" }] } as never);
    const res = await POST(jsonReq({ kind: "WEIRD", minutes: 9999 }));
    expect(res.status).toBe(201);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("INSERT INTO break_sessions");
    expect(args).toEqual(["u-1", "SHORT", 240, null]);
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [{ id: 1, kind: "MOVEMENT", minutes: 10, note: "x", startedAt: "y" }] } as never);
    const res = await POST(jsonReq({ kind: "MOVEMENT", minutes: 10, note: "  注意  " }));
    expect(res.status).toBe(201);
    const [sql, args] = queryMock.mock.calls[0] as unknown[];
    expect(String(sql)).toContain("anon_id");
    expect(args).toEqual(["anon-1", "MOVEMENT", 10, "注意"]);
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
