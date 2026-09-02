import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("../../copy-domain", () => ({
  copyDomainContentFromRows: vi.fn(),
  prefixFromKey: vi.fn((s: string) => s.replace(/[^a-z0-9]+/g, "-")),
}));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { copyDomainContentFromRows } from "../../copy-domain";
import { POST } from "./route";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const currentUserIdMock = vi.mocked(currentUserId);
const copyMock = vi.mocked(copyDomainContentFromRows);

function post(key: string, body?: unknown) {
  return POST(new Request("http://localhost/api/domains/" + key + "/duplicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { params: Promise.resolve({ key }) });
}

const sourceSystem = {
  career_key: "english", name: "英语学习", description: "英语", is_locked: false,
  sort_order: 3, owner_id: null, kind: "language", icon: "languages",
  color: "#2563eb", phase_prefix: "E", is_archived: false,
};
const sourceOther = { ...sourceSystem, career_key: "english-other", owner_id: "u-2" };
const created = {
  career_key: "english-c-abc12345", name: "英语学习（副本）", description: "英语", is_locked: false,
  sort_order: 50, owner_id: "u-1", kind: "language", icon: "languages",
  color: "#2563eb", phase_prefix: "E", is_archived: false,
};

function fakeClient() {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockResolvedValue({ rows: [] });
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
  copyMock.mockResolvedValue(3);
});

describe("POST /api/domains/:key/duplicate", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await post("english");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "请先登录" });
  });

  it("returns 400 when key missing", async () => {
    const res = await post("");
    expect(res.status).toBe(400);
  });

  it("returns 404 when source domain not visible", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const res = await post("ghost");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "学习领域不存在" });
  });

  it("returns 403 for another user's domain", async () => {
    queryMock.mockResolvedValueOnce({ rows: [sourceOther] } as never);
    const res = await post("english-other");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "无权操作他人自定义领域" });
  });

  it("duplicates a system domain as an owned copy with content", async () => {
    const client = fakeClient();
    connectMock.mockResolvedValue(client as never);
    queryMock.mockResolvedValueOnce({ rows: [sourceSystem] } as never); // loadVisibleDomain
    client.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [] } as never) // exists check
      .mockResolvedValueOnce({ rows: [{ id: 88 }] } as never) // INSERT careers
      .mockResolvedValueOnce({ rows: [{ id: 1, phase_key: "e1", title: "P1", weeks: null, track: "main", summary: null, sort_order: 0 }] } as never) // phases
      .mockResolvedValueOnce({ rows: [{ id: 11, phase_id: 1, topic_key: "t1", title: "T1", summary: null, agent_task: null, sort_order: 0 }] } as never) // topics
      .mockResolvedValueOnce({ rows: [{ id: 101, topic_id: 11, name: "r", url: null, kind: "doc", sort_order: 0 }] } as never) // resources
      .mockResolvedValueOnce({ rows: [{ id: 201, topic_id: 11, text: "p", sort_order: 0 }] } as never) // practices
      .mockResolvedValueOnce({ rows: [{ id: 301, topic_id: 11, name: "pr", description: null, repo_url: null, deliverable: null, sort_order: 0 }] } as never) // projects
      .mockResolvedValueOnce({ rows: [{ id: 401, topic_id: 11, text: "c", sort_order: 0 }] } as never) // checkpoints
      .mockResolvedValueOnce({ rows: [] } as never) // UPDATE sort_order
      .mockResolvedValueOnce({ rows: [created] } as never); // SELECT created
    const res = await post("english", { name: "英语学习（副本）" });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    const insertCall = client.query.mock.calls[2];
    expect(String(insertCall[0])).toContain("INSERT INTO careers");
    const insertParams = insertCall[1] as unknown[];
    const newKey = String(insertParams[0]);
    expect(newKey).toMatch(/^english-c-[0-9a-f]{8}$/);
    expect(json.domain).toMatchObject({ owner_id: "u-1", name: "英语学习（副本）" });
    expect(json.domain.career_key).toMatch(/^english-c-[0-9a-f]{8}$/);
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(copyMock).toHaveBeenCalledTimes(1);
    expect(copyMock.mock.calls[0][1]).toBe("english");
    expect(copyMock.mock.calls[0][2]).toBe(newKey);
    expect(client.release).toHaveBeenCalled();
  });

  it("rolls back and rethrows when content clone fails", async () => {
    const client = fakeClient();
    connectMock.mockResolvedValue(client as never);
    queryMock.mockResolvedValueOnce({ rows: [sourceSystem] } as never);
    client.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [] } as never) // exists
      .mockResolvedValueOnce({ rows: [{ id: 88 }] } as never) // insert
      .mockResolvedValueOnce({ rows: [] } as never) // phases load
      .mockResolvedValueOnce({ rows: [] } as never) // topics load
      .mockRejectedValue(new Error("boom")); // child load / clone
    await expect(post("english")).rejects.toThrow("boom");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});