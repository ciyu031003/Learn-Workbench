import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/anon", () => ({ userScope: vi.fn(), scopeWhere: vi.fn() }));
import { pgPool } from "@/lib/db";
import { userScope, scopeWhere } from "@/lib/anon";
import { GET, PUT } from "./route";

const queryMock = vi.mocked(pgPool.query);
const userScopeMock = vi.mocked(userScope);
const scopeWhereMock = vi.mocked(scopeWhere);

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  scopeWhereMock.mockImplementation((_scope, base) => ({ params: base as unknown[], sql: "" }));
});

describe("GET /api/profile/info", () => {
  it("returns stored profile for logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          weightKg: "72",
          education: [ { school: "X", major: "Y" } ],
          experiences: null,
          currentCity: "乌鲁木齐",
          targetRole: "网络安全工程师",
          bio: "hey",
        },
      ],
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentCity).toBe("乌鲁木齐");
    expect(body.targetRole).toBe("网络安全工程师");
    expect(body.education).toHaveLength(1);
    expect(String(queryMock.mock.calls[0][0])).toContain("user_settings");
  });

  it("empty row → defaults", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-1" });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await GET();
    const body = await res.json();
    expect(body.currentCity).toBe("");
    expect(body.bio).toBe("");
    expect(body.weightKg).toBe(60);
  });
});

describe("PUT /api/profile/info", () => {
  it("updates provided fields for logged-in user", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({
      rows: [{ education: [{ school: "A" }], experiences: null, currentCity: "北京", targetRole: "后端", bio: "" }],
    } as never);
    const res = await PUT(jsonReq({ currentCity: "北京", targetRole: "后端" }));
    expect(res.status).toBe(200);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args).toContain("北京");
    expect(String(queryMock.mock.calls[0][0])).toContain("ON CONFLICT (user_id)");
  });

  it("falls back to anon upsert when logged out", async () => {
    userScopeMock.mockResolvedValue({ uid: null, anonId: "anon-9" });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await PUT(jsonReq({ bio: "hi" }));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("anon_id");
  });

  it("rejects invalid body", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    const res = await PUT(jsonReq({ currentCity: 123 }));
    expect(res.status).toBe(400);
  });

  it("empty body still upserts (touches updated_at)", async () => {
    userScopeMock.mockResolvedValue({ uid: "u-1", anonId: null });
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await PUT(jsonReq({}));
    expect(res.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("updated_at = now()");
  });
});