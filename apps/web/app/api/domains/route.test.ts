import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { GET, POST, PATCH, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);

function jsonReq(method: string, body: unknown, url = "http://localhost/api/domains") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeClient() {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockResolvedValue({ rows: [] });
  return client;
}

const row = (over: Record<string, unknown> = {}) => ({
  career_key: "english-c-12345678",
  name: "英语学习",
  description: null,
  is_locked: false,
  sort_order: 42,
  owner_id: "u-1",
  kind: "language",
  icon: "languages",
  color: "#2563eb",
  phase_prefix: "E",
  is_archived: false,
  ...over,
});

const serialized = (over: Record<string, unknown> = {}) => ({
  career_key: "english-c-12345678",
  name: "英语学习",
  description: null,
  is_locked: false,
  sort_order: 42,
  owner_id: "u-1",
  kind: "language",
  icon: "languages",
  color: "#2563eb",
  phase_prefix: "E",
  is_archived: false,
  kind_label: "语言学习",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("GET /api/domains", () => {
  it("returns domains with kind_label", async () => {
    queryMock.mockResolvedValue({ rows: [row()] } as never);
    const res = await GET(new Request("http://localhost/api/domains"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ domains: [serialized()] });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("owner_id IS NULL OR owner_id = $1"),
      ["u-1"]
    );
  });

  it("passes null scope for anonymous users", async () => {
    currentUserIdMock.mockResolvedValue(null);
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/domains"));
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("owner_id = $1"), [null]);
  });

  it("lists archived owned domains when archived=1", async () => {
    queryMock.mockResolvedValue({ rows: [row({ is_archived: true })] } as never);
    const res = await GET(new Request("http://localhost/api/domains?archived=1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.domains).toEqual([serialized({ is_archived: true })]);
    expect(json.templates).toBeUndefined();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("owner_id = $1 AND is_archived = TRUE"),
      ["u-1"]
    );
  });

  it("includes built-in templates when templates=1", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/domains?templates=1"));
    const json = await res.json();
    expect(json.domains).toEqual([]);
    expect(json.templates.map((t: { key: string }) => t.key)).toEqual(["english", "badminton", "ball-sports"]);
    expect(json.templates[0]).toMatchObject({ name: "英语学习", kind: "language", phaseCount: 5 });
  });

  it("returns a single template preview with ?template=english", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const res = await GET(new Request("http://localhost/api/domains?template=english"));
    const json = await res.json();
    expect(json.template).toMatchObject({ key: "english", name: "英语学习" });
    expect(json.domains).toBeUndefined();
  });
});
describe("POST /api/domains", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(jsonReq("POST", { template: "english" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "请先登录" });
  });

  it("returns 400 for an unknown template", async () => {
    const res = await POST(jsonReq("POST", { template: "nope" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "模板不存在" });
  });

  it("creates a blank custom domain", async () => {
    const client = fakeClient();
    connectMock.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [] } as never) // key exists check
      .mockResolvedValueOnce({ rows: [{ id: 99 }] } as never) // INSERT careers RETURNING id
      .mockResolvedValueOnce({ rows: [] } as never) // sort_order update
      .mockResolvedValueOnce({ rows: [row({ career_key: "new-domain-c-abc", name: "新领域", kind: "custom", icon: "compass", color: "#6366f1", phase_prefix: "P" })] } as never); // read created
    const res = await POST(jsonReq("POST", { name: "新领域" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.domain.kind).toBe("custom");
    expect(json.domain.kind_label).toBe("自定义");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO careers"), expect.arrayContaining(["新领域", "u-1"]));
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});
  it("copies template phases as owned content", async () => {
    const client = fakeClient();
    connectMock.mockResolvedValue(client as never);
    let careersLookups = 0;
    const createdRow = {
      career_key: "english-c-x", name: "英语学习", description: "d", is_locked: false,
      sort_order: 100, owner_id: "u-1", kind: "language", icon: "languages",
      color: "#2563eb", phase_prefix: "E", is_archived: false,
    };
    client.query.mockImplementation((sql: string) => {
      if (sql.includes("BEGIN")) return Promise.resolve({ rows: [] });
      if (sql.includes("INSERT INTO careers")) return Promise.resolve({ rows: [{ id: 100 }] });
      if (sql.includes("UPDATE careers SET sort_order")) return Promise.resolve({ rows: [] });
      if (sql.includes("FROM careers WHERE career_key") && !sql.includes("SELECT 1")) {
        careersLookups += 1;
        // 第一次为存在性检查（应为空），第二次为创建后回读
        if (careersLookups === 2) return Promise.resolve({ rows: [createdRow] });
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] }); // key EXISTS checks + template phase/topic/child inserts
    });
    const res = await POST(jsonReq("POST", { template: "english" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.domain.career_key.startsWith("english-c-")).toBe(true);
    expect(json.domain.kind).toBe("language");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO content_phases"), expect.anything());
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO content_topics"), expect.anything());
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO content_practices"), expect.anything());
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO content_checkpoints"), expect.anything());
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("rolls back when template copy fails", async () => {
    const client = fakeClient();
    connectMock.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [] } as never) // exists
      .mockResolvedValueOnce({ rows: [{ id: 100 }] } as never) // INSERT careers
      .mockRejectedValue(new Error("db boom")); // copy fails
    await expect(POST(jsonReq("POST", { template: "badminton" }))).rejects.toThrow("db boom");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
describe("PATCH /api/domains", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await PATCH(jsonReq("PATCH", { key: "english", name: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an empty name", async () => {
    const res = await PATCH(jsonReq("PATCH", { key: "english", name: "  " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "领域名称不能为空" });
  });

  it("returns 400 when the domain does not exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await PATCH(jsonReq("PATCH", { key: "ghost", name: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for system built-in domains", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never);
    const res = await PATCH(jsonReq("PATCH", { key: "ict", name: "hack" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "系统内置领域不可编辑" });
  });

  it("returns 403 for another user's domain", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: "u-2" }] } as never);
    const res = await PATCH(jsonReq("PATCH", { key: "english", name: "hack" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "无权操作他人自定义领域" });
  });
  it("archives and unarchives an owned domain via isArchived", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ owner_id: "u-1" }] } as never)
      .mockResolvedValueOnce({ rows: [row({ is_archived: true })] } as never);
    const res = await PATCH(jsonReq("PATCH", { key: "english-c-12345678", isArchived: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.domain.is_archived).toBe(true);
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE careers SET is_archived = $1"),
      [true, "english-c-12345678"]
    );
  });

  it("returns 400 for an invalid isArchived value", async () => {
    const res = await PATCH(jsonReq("PATCH", { key: "english-c-12345678", isArchived: "yes" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "归档标记无效" });
  });


  it("updates owned custom domain fields", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ owner_id: "u-1" }] } as never)
      .mockResolvedValueOnce({ rows: [row({ name: "英语 · 雅思", icon: "book-open", color: "#0ea5e9", phase_prefix: "E2" })] } as never);
    const res = await PATCH(jsonReq("PATCH", { key: "english-c-12345678", name: " 英语 · 雅思 ", icon: "book-open", color: "#0EA5E9", phasePrefix: "e2" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.domain.name).toBe("英语 · 雅思");
    expect(json.domain.phase_prefix).toBe("E2");
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE careers SET name = $1, icon = $2, color = $3, phase_prefix = $4"),
      ["英语 · 雅思", "book-open", "#0ea5e9", "E2", "english-c-12345678"]
    );
  });
});
describe("DELETE /api/domains", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/domains?key=english"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when key is missing", async () => {
    const res = await DELETE(new Request("http://localhost/api/domains"));
    expect(res.status).toBe(400);
  });

  it("returns 403 for system domains", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ owner_id: null }] } as never);
    const res = await DELETE(new Request("http://localhost/api/domains?key=ict"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "系统内置领域不可删除" });
  });

  it("deletes an empty owned domain without a transaction", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ owner_id: "u-1" }] } as never)
      .mockResolvedValueOnce({ rows: [{ c: "0" }] } as never);
    const res = await DELETE(new Request("http://localhost/api/domains?key=english-c-12345678"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(queryMock).toHaveBeenLastCalledWith("DELETE FROM careers WHERE career_key = $1", ["english-c-12345678"]);
  });

  it("deletes an owned domain with phases in one transaction", async () => {
    const client = fakeClient();
    connectMock.mockResolvedValue(client as never);
    queryMock
      .mockResolvedValueOnce({ rows: [{ owner_id: "u-1" }] } as never)
      .mockResolvedValueOnce({ rows: [{ c: "3" }] } as never);
    const res = await DELETE(new Request("http://localhost/api/domains?key=english-c-12345678"));
    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("DELETE FROM content_phases WHERE career_key = $1", ["english-c-12345678"]);
    expect(client.query).toHaveBeenCalledWith("DELETE FROM careers WHERE career_key = $1", ["english-c-12345678"]);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});
