import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
vi.mock("@/lib/resume", () => ({
  assembleResumeContent: vi.fn(),
  parseSectionOrder: (raw: unknown) => (Array.isArray(raw) ? raw : []),
  parseStyles: (tpl: string, raw: unknown) => ({ ...(raw as object), accent: "#2f74c0", _tpl: tpl }),
}));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { parseBody } from "@/lib/http";
import { assembleResumeContent } from "@/lib/resume";
import { GET, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);
const parseBodyMock = vi.mocked(parseBody);
const assembleMock = vi.mocked(assembleResumeContent);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
  assembleMock.mockResolvedValue({
    basics: { name: "张三", headline: "网络安全", city: "乌鲁木齐", targetRole: "安全工程师", summary: "", email: "" },
    education: [], experience: [], skills: [], projects: [], certificates: [],
  } as never);
});

describe("GET /api/resumes/[id]", () => {
  it("returns document config plus assembled content", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({
      rows: [{ id: 1, title: "简历", templateKey: "classic", sectionOrder: [{ key: "basics", visible: true }], styles: {}, overrides: {}, isDefault: false, updatedAt: "x" }],
    } as never);
    const res = await GET(new Request("http://localhost"), ctx("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.document.templateKey).toBe("classic");
    expect(body.content.basics.name).toBe("张三");
    expect(assembleMock).toHaveBeenCalled();
  });

  it("rejects invalid id", async () => {
    const res = await GET(new Request("http://localhost"), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("404 when not found", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost"), ctx("9"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/resumes/[id]", () => {
  it("updates template and section order", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { templateKey: "sidebar", sectionOrder: [{ key: "basics", visible: true }] } });
    queryMock.mockResolvedValue({
      rows: [{ id: 1, title: "简历", templateKey: "sidebar", sectionOrder: [{ key: "basics", visible: true }], styles: {}, overrides: {}, isDefault: false, updatedAt: "x" }],
    } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("template_key = $3");
    expect(sql).toContain("section_order = $4");
  });

  it("rejects unknown template", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { templateKey: "does-not-exist" } });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("rejects empty title", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: { title: "   " } });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("rejects when nothing to update", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    parseBodyMock.mockResolvedValue({ ok: true, data: {} });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/resumes/[id]", () => {
  it("soft-deletes", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("deleted_at = now()");
  });
});