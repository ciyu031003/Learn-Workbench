import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@learn-workbench/shared", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { ...mod, todayISO: vi.fn(() => "2026-08-29") };
});
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET, POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/wellbeing/exercise", () => {
  it("aggregates today logs + target", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 1, type: "BALL", typeLabel: "篮球", durationSeconds: 1800, source: "MANUAL", note: null, startedAt: "x" }],
    } as never);
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, targetMinutes: 45 }] } as never);
    const res = await GET(new Request("http://localhost/api/wellbeing/exercise"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalMinutes).toBe(30);
    expect(body.targetMinutes).toBe(45);
    expect(body.logs).toHaveLength(1);
  });
});

describe("POST /api/wellbeing/exercise", () => {
  it("rejects bad duration by clamping to 0 and defaults type to OTHER", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, type: "OTHER", typeLabel: null, durationSeconds: 0, source: "MANUAL", note: null, startedAt: "x" }] } as never);
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[1]).toBe("OTHER");
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValue({ rows: [{ id: 1, type: "AEROBIC", typeLabel: "快走", durationSeconds: 600, source: "MANUAL", note: null, startedAt: "x" }] } as never);
    const res = await POST(jsonReq({ type: "AEROBIC", typeLabel: "快走", durationSeconds: 600 }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-1");
  });
});

describe("DELETE /api/wellbeing/exercise", () => {
  it("soft-deletes by id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/wellbeing/exercise?id=7"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at");
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}