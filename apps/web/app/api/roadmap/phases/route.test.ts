import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/roles", () => ({ hasRole: vi.fn(), ADMIN_ROLES: ["admin"] }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { hasRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";
import { POST, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);
const hasRoleMock = vi.mocked(hasRole);
const auditMock = vi.mocked(writeAuditLog);

function req(method: string, body?: unknown, query = "") {
  return new Request(`http://localhost/api/roadmap/phases${query}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function fakeClient() {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockResolvedValue({ rows: [] });
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
  hasRoleMock.mockResolvedValue(false); // 默认普通用户
});

describe("POST /api/roadmap/phases", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(req("POST", { title: "t" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty title", async () => {
    const res = await POST(req("POST", { title: "  " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "阶段标题不能为空" });
  });

  it("creates a custom phase and renumbers the track", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never) // SELECT careers domain (system)
      .mockResolvedValueOnce({ rows: [{ id: 9 }] } as never) // INSERT RETURNING
      .mockResolvedValueOnce({ rows: [{ id: 9, phase_key: "phase-8", title: "新阶段", weeks: null, track: "main", summary: null, sort_order: 7, is_custom: true }] } as never); // SELECT created
    connectMock.mockResolvedValue(client as never);

    const res = await POST(req("POST", { career: "ict", track: "main", title: " 新阶段 ", summary: "", weeks: "第 37-40 周" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.phase.phase_key).toBe("phase-8");
    expect(json.phase.is_custom).toBe(true);

    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO content_phases"), [
      "ict", "新阶段", "第 37-40 周", "main", null, "u-1",
    ]);
    // renumberTrack 使用独立连接
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
    expect(client.release).toHaveBeenCalled();
  });
});

describe("PATCH /api/roadmap/phases", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await PATCH(req("PATCH", { id: 1, title: "t" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const res = await PATCH(req("PATCH", { id: "x", title: "t" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the phase does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await PATCH(req("PATCH", { id: 999, title: "t" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when editing another user custom phase", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: true, owner_id: "u-2" }] } as never);
    const res = await PATCH(req("PATCH", { id: 7, title: "hack" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "无权操作他人自定义阶段" });
  });
  it("普通用户不能修改系统内置阶段（S1-3 越权修复）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: false, owner_id: null }] } as never);
    const res = await PATCH(req("PATCH", { id: 1, title: "hack" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "系统阶段仅管理员可修改" });
    expect(hasRoleMock).toHaveBeenCalledWith("u-1", ["admin"]);
  });

  it("管理员可以修改系统阶段，且 SQL 双保险允许 is_custom=false", async () => {
    hasRoleMock.mockResolvedValue(true);
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: false, owner_id: null }] } as never) // SELECT current
      .mockResolvedValueOnce({ rows: [] } as never); // UPDATE
    connectMock.mockResolvedValue(client as never);

    const res = await PATCH(req("PATCH", { id: 1, title: "改后", summary: "s", weeks: "第 1-2 周" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const updateCall = queryMock.mock.calls[1];
    expect(updateCall[0]).toContain("UPDATE content_phases");
    expect(updateCall[0]).toContain("owner_id = $5");
    expect(updateCall[1]).toEqual(["改后", "s", "第 1-2 周", 1, "u-1", true]);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "roadmap.phase.update", actorId: "u-1", targetId: "1" })
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
  });

  it("管理员换轨时两条 track 都重编号", async () => {
    hasRoleMock.mockResolvedValue(true);
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "agent", is_custom: false, owner_id: null }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    connectMock.mockResolvedValue(client as never);

    const res = await PATCH(req("PATCH", { id: 8, track: "main" }));
    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "agent"]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
  });

  it("普通用户可以修改自己的自建阶段", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: true, owner_id: "u-1" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    connectMock.mockResolvedValue(client as never);

    const res = await PATCH(req("PATCH", { id: 7, title: "我的阶段" }));
    expect(res.status).toBe(200);
    const updateCall = queryMock.mock.calls[1];
    expect(updateCall[1]).toEqual(["我的阶段", 7, "u-1", false]);
  });
});

describe("DELETE /api/roadmap/phases", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(req("DELETE", undefined, "?id=1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const res = await DELETE(req("DELETE", undefined, "?id=abc"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the phase does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await DELETE(req("DELETE", undefined, "?id=999"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when deleting another user custom phase", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: true, owner_id: "u-2" }] } as never);
    const res = await DELETE(req("DELETE", undefined, "?id=7"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "无权操作他人自定义阶段" });
  });
  it("普通用户不能删除系统内置阶段（级联删全局内容）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: false, owner_id: null }] } as never);
    const res = await DELETE(req("DELETE", undefined, "?id=3"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "系统阶段仅管理员可修改" });
  });

  it("管理员删除系统阶段：SQL 带双保险条件并写审计", async () => {
    hasRoleMock.mockResolvedValue(true);
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: false, owner_id: null }] } as never) // SELECT current
      .mockResolvedValueOnce({ rows: [] } as never); // DELETE
    connectMock.mockResolvedValue(client as never);

    const res = await DELETE(req("DELETE", undefined, "?id=3"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const delCall = queryMock.mock.calls[1];
    expect(delCall[0]).toContain("DELETE FROM content_phases");
    expect(delCall[0]).toContain("owner_id = $2");
    expect(delCall[1]).toEqual([3, "u-1", true]);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "roadmap.phase.delete", targetId: "3" })
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM content_phases"), ["ict", "main"]);
  });

  it("普通用户可以删除自己的自建阶段", async () => {
    const client = fakeClient();
    queryMock
      .mockResolvedValueOnce({ rows: [{ career_key: "ict", track: "main", is_custom: true, owner_id: "u-1" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    connectMock.mockResolvedValue(client as never);

    const res = await DELETE(req("DELETE", undefined, "?id=7"));
    expect(res.status).toBe(200);
    expect(queryMock.mock.calls[1][1]).toEqual([7, "u-1", false]);
  });
});
