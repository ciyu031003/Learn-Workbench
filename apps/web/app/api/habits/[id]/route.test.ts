import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("PATCH /api/habits/[id]", () => {
  it("updates name and schedule", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "早睡", schedule: [1, 2, 3] } });
    queryMock.mockResolvedValue({ rows: [{ id: 1, name: "早睡" }] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("UPDATE habits");
    expect(sql).toContain("name = $3");
    expect(sql).toContain("schedule = $4");
  });

  it("archives a habit", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { archived: true } });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(String(queryMock.mock.calls[0][0])).toContain("archived_at = $3");
  });

  it("rejects an invalid color", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { color: "blue" } });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("rejects when nothing to update", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: {} });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("404 when habit not found", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { name: "x" } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("9"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/habits/[id]", () => {
  it("soft-deletes", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at = now()");
  });

  it("rejects an invalid id", async () => {
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("abc"));
    expect(res.status).toBe(400);
  });
});