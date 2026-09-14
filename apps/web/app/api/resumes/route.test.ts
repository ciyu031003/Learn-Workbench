import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { GET, POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("GET /api/resumes", () => {
  it("lists non-deleted documents", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 1, title: "简历", templateKey: "classic", isDefault: false, updatedAt: "x" }] } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents).toHaveLength(1);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at IS NULL");
  });
});

describe("POST /api/resumes", () => {
  it("creates with default template and section order for logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [{ id: 2, title: "我的简历", templateKey: "classic" }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe("u-1");
    expect(args[1]).toBe("我的简历");
    expect(args[2]).toBe("classic");
    // section_order 为默认 6 节
    expect(JSON.parse(String(args[3]))).toHaveLength(6);
  });

  it("rejects unknown template key by falling back to classic", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { templateKey: "nope" } });
    queryMock.mockResolvedValue({ rows: [{ id: 3 }] } as never);
    await POST(new Request("http://localhost", { method: "POST" }));
    expect((queryMock.mock.calls[0][1] as unknown[])[2]).toBe("classic");
  });

  it("creates with anon id when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    queryMock.mockResolvedValue({ rows: [{ id: 4 }] } as never);
    const res = await POST(new Request("http://localhost", { method: "POST" }));
    expect(res.status).toBe(201);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
    expect((queryMock.mock.calls[0][1] as unknown[])[0]).toBe("anon-9");
  });
});