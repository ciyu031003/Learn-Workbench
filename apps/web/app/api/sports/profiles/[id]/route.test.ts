import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const tokenMock = vi.mocked(currentSessionToken);
const userMock = vi.mocked(currentUserId);
const parseBodyMock = vi.mocked(parseBody);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  parseBodyMock.mockResolvedValue({ ok: true, data: {} });
});

describe("PATCH /api/sports/profiles/[id]", () => {
  it("updates text fields", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { identity: "双打搭子", levelText: "中羽 2 级" } });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("identity = $3");
    expect(sql).toContain("level_text = $4");
  });

  it("keeps the existing share slug when turning public", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { isPublic: true } });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(String(queryMock.mock.calls[0][0])).toContain("share_slug = COALESCE(share_slug,");
  });

  it("clears the share slug when turning private", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { isPublic: false } });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(String(queryMock.mock.calls[0][0])).toContain("share_slug = NULL");
  });

  it("写入战绩三项与绝技（场次取 max(填写, 胜+负)）", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { wins: 15, losses: 5, signatureMove: "疾风·劈杀" } });
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] } as never);
    await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    const sql = String(queryMock.mock.calls[0][0]);
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toContain("matches_played = $3");
    expect(sql).toContain("wins = $4");
    expect(sql).toContain("losses = $5");
    expect(sql).toContain("signature_move = $6");
    expect(args.slice(2)).toEqual([20, 15, 5, "疾风·劈杀"]);
  });

  it("requires login", async () => {
    tokenMock.mockResolvedValue(null);
    parseBodyMock.mockResolvedValue({ ok: true, data: { identity: "x" } });
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("1"));
    expect(res.status).toBe(401);
  });

  it("404 when not found", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    parseBodyMock.mockResolvedValue({ ok: true, data: { identity: "x" } });
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await PATCH(new Request("http://localhost", { method: "PATCH" }), ctx("9"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/sports/profiles/[id]", () => {
  it("soft-deletes and makes it private", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("deleted_at = now()");
    expect(sql).toContain("is_public = false");
  });

  it("requires login", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(401);
  });
});