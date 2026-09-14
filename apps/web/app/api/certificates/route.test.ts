import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, POST, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

const row = {
  id: 1,
  name: "HCIP-Datacom",
  targetDate: "2026-06-01",
  status: "preparing",
  issuer: "华为",
  earnedDate: null,
  expiryDate: "2028-06-01",
  imageUrl: null,
  sortOrder: 0,
  note: null,
  updatedAt: "x",
};

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/certificates", () => {
  it("returns non-deleted certificates ordered", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [row] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.records).toHaveLength(1);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("FROM certificates");
    expect(sql).toContain("deleted_at IS NULL");
  });

  it("uses anon scope when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    scopeWhereMock.mockImplementation((_scope, base) => ({ params: [...(base as unknown[]), "anon-1"], sql: " AND (anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $2)" }));
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
  });
});

describe("POST /api/certificates", () => {
  it("rejects empty name", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "  " } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid status", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "CISP", status: "nope" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("inserts for logged-in user with normalized dates", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({
      ok: true,
      data: { name: "CISP", status: "achieved", expiryDate: "2028-09-30", targetDate: "not-a-date", issuer: "中国信息安全测评中心" },
    });
    queryMock.mockResolvedValue({ rows: [row] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    expect(args).toContain("CISP");
    // targetDate 非法 → null
    expect(args).toContain(null);
    expect(String(queryMock.mock.calls[0][0])).toContain("INSERT INTO certificates");
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "CISP" } });
    queryMock.mockResolvedValue({ rows: [row] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-9");
  });
});

describe("PATCH /api/certificates", () => {
  it("updates provided fields only", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { id: 3, expiryDate: "2029-01-01", status: "achieved" } });
    queryMock.mockResolvedValue({ rows: [row] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("UPDATE certificates");
    expect(sql).toContain("status = $3");
    expect(sql).toContain("expiry_date = $4");
  });

  it("rejects when no updatable field", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { id: 3 } });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no row matches", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { id: 99, name: "x" } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/certificates", () => {
  it("soft-deletes by id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/certificates?id=5"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at");
  });

  it("rejects invalid id", async () => {
    const res = await DELETE(new Request("http://localhost/api/certificates?id=abc"));
    expect(res.status).toBe(400);
  });
});