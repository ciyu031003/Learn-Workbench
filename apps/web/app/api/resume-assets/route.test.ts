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

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/resume-assets", () => {
  it("filters by kind and returns records", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{ id: 1, kind: "skill", title: "Linux", content: null, url: null, sortOrder: 0, updatedAt: "x" }],
    } as never);
    const res = await GET(new Request("http://localhost/api/resume-assets?kind=skill"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.records).toHaveLength(1);
    expect(String(queryMock.mock.calls[0][0])).toContain("kind = $2");
  });
});

describe("POST /api/resume-assets", () => {
  it("rejects bad kind", async () => {
    parseBodyMock.mockResolvedValue({ ok: true, data: { kind: "bad", title: "x" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(400);
  });

  it("inserts with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    parseBodyMock.mockResolvedValue({ ok: true, data: { kind: "github", title: "repo", url: "https://x" } });
    queryMock.mockResolvedValue({ rows: [{ id: 1, kind: "github", title: "repo", content: null, url: "https://x", sortOrder: 0, updatedAt: "x" }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-9");
  });
});

describe("PATCH /api/resume-assets", () => {
  it("updates title and url", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { id: 3, title: "New", url: "https://y" } });
    queryMock.mockResolvedValue({ rows: [{ id: 3, kind: "skill", title: "New", content: null, url: "https://y", sortOrder: 0, updatedAt: "x" }] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("UPDATE resume_assets");
    expect(String(queryMock.mock.calls[0][0])).toContain("title = $3");
  });

  it("returns 404 when no row matches", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { id: 99, title: "x" } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/resume-assets", () => {
  it("soft-deletes by id", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost/api/resume-assets?id=5"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at");
  });
});