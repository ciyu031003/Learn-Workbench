import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/wellbeing/weight", () => {
  it("returns ascending points + latest", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [
        { id: "1", logDate: "2026-09-01", weightKg: "63.2" },
        { id: "2", logDate: "2026-09-10", weightKg: "62.4" },
      ],
    } as never);
    const res = await GET(new Request("http://localhost/api/wellbeing/weight?days=30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(30);
    expect(body.points).toHaveLength(2);
    expect(body.points[1].weightKg).toBe(62.4);
    expect(body.latest).toEqual({ id: 2, date: "2026-09-10", weightKg: 62.4 });
    expect(String(queryMock.mock.calls[0][0])).toContain("FROM weight_logs");
  });

  it("clamps days to 1..365 and honours a valid end date", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);

    const big = await (await GET(new Request("http://localhost/api/wellbeing/weight?days=9999"))).json();
    expect(big.days).toBe(365);

    const withEnd = await (
      await GET(new Request("http://localhost/api/wellbeing/weight?days=7&end=2026-09-10"))
    ).json();
    expect(withEnd.days).toBe(7);
    expect(queryMock.mock.calls[1][1]).toEqual(["u-1", "2026-09-10", 7]);
    expect(String(queryMock.mock.calls[1][0])).toContain("$2::date");

    await GET(new Request("http://localhost/api/wellbeing/weight?days=7&end=nope"));
    expect(String(queryMock.mock.calls[2][0])).toContain("CURRENT_DATE");
  });
});

describe("POST /api/wellbeing/weight", () => {
  it("rejects an invalid weight", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { weightKg: 0 } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("upserts today's weight and syncs user_settings", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { weightKg: 62.44, date: "2026-09-15" } });
    queryMock.mockResolvedValue({ rows: [] } as never);

    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.weightKg).toBe(62.4);
    // 第一条 INSERT 带 ON CONFLICT (user_id, log_date)
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (user_id, log_date)");
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1", "2026-09-15", 62.4, null]);
    // 第二条同步 user_settings.weight_kg
    expect(String(queryMock.mock.calls[1][0])).toContain("user_settings");
    expect(queryMock.mock.calls[1][1]).toEqual(["u-1", 62.4]);
  });

  it("clamps out-of-range weight instead of failing", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { weightKg: 999 } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect((await res.json()).weightKg).toBe(300);
  });

  it("uses anon_id branch when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    parseBodyMock.mockResolvedValue({ ok: true, data: { weightKg: 58 } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (anon_id, log_date)");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-1");
  });
});

describe("DELETE /api/wellbeing/weight", () => {
  it("soft-deletes and validates id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const ok = await DELETE(new Request("http://localhost/api/wellbeing/weight?id=5", { method: "DELETE" }));
    expect(ok.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at = now()");
    const bad = await DELETE(new Request("http://localhost/api/wellbeing/weight?id=x", { method: "DELETE" }));
    expect(bad.status).toBe(400);
  });
});
