import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET, PUT, DEFAULT_WEIGHT_KG } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/wellbeing/profile", () => {
  it("returns stored weight for logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ weightKg: "72.5" }] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weightKg).toBe(72.5);
    expect(String(queryMock.mock.calls[0][0])).toContain("user_settings");
  });

  it("falls back to default 60 when no row / anon", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.weightKg).toBe(DEFAULT_WEIGHT_KG);
    expect(body.weightKg).toBe(60);
  });
});

describe("PUT /api/wellbeing/profile", () => {
  it("clamps weight into 20-300 and upserts by user_id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ weightKg: "300" }] } as never);
    const res = await PUT(jsonReq({ weightKg: 9999 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weightKg).toBe(300);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    expect(args[1]).toBe(300);
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (user_id)");
  });

  it("falls back to anon_id upsert when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    queryMock.mockResolvedValueOnce({ rows: [{ weightKg: "55" }] } as never);
    const res = await PUT(jsonReq({ weightKg: 55 }));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-9");
  });

  it("invalid body falls back to default weight", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [{ weightKg: "60" }] } as never);
    const res = await PUT(jsonReq({ weightKg: "abc" }));
    const body = await res.json();
    expect(body.weightKg).toBe(60);
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
