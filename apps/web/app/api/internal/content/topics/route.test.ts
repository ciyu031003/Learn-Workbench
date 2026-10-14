import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}) }));
vi.mock("@/lib/content/content-editor", () => ({
  listTopics: vi.fn(async () => ({ rows: [], total: 0, limit: 50, offset: 0 })),
  normalizeTopicPatch: vi.fn(() => ({ ok: true, patch: { title: "新标题" } })),
  updateTopic: vi.fn(async () => ({ ok: true })),
}));
import { listTopics, normalizeTopicPatch, updateTopic } from "@/lib/content/content-editor";
import { GET, PATCH } from "./route";

const listMock = vi.mocked(listTopics);
const normalizeMock = vi.mocked(normalizeTopicPatch);
const updateMock = vi.mocked(updateTopic);

function req(method: "GET" | "PATCH", body?: unknown, secret = "s3cr3t", query = "") {
  return new Request("http://localhost/api/internal/content/topics" + query, {
    method,
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: method === "PATCH" ? JSON.stringify(body ?? {}) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  listMock.mockResolvedValue({ rows: [], total: 0, limit: 50, offset: 0 });
  normalizeMock.mockReturnValue({ ok: true, patch: { title: "新标题" } } as never);
  updateMock.mockResolvedValue({ ok: true } as never);
});

describe("/api/internal/content/topics", () => {
  it("没有密钥时 403", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("GET", undefined, "wrong"))).status).toBe(403);
    process.env.CRON_SECRET = "s3cr3t";
    expect((await PATCH(req("PATCH", { trackSlug: "python", key: "python-files" }, "wrong"))).status).toBe(403);
  });

  it("GET 支持关键词与课程筛选", async () => {
    const res = await GET(req("GET", undefined, "s3cr3t", "?q=文件&track=python"));
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({ q: "文件", track: "python", limit: undefined, offset: undefined });
  });

  it("PATCH 缺 trackSlug/key → 400", async () => {
    expect((await PATCH(req("PATCH", { patch: { title: "x" } }))).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH 校验失败 → 400", async () => {
    normalizeMock.mockReturnValueOnce({ ok: false, error: "不支持修改字段：sort_order" } as never);
    const res = await PATCH(req("PATCH", { trackSlug: "python", key: "k", patch: { sort_order: 1 } }));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH 成功 → 200", async () => {
    const res = await PATCH(req("PATCH", { trackSlug: "python", key: "python-files", patch: { title: "新标题" } }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("python", "python-files", { title: "新标题" });
  });

  it("知识点不存在 → 404", async () => {
    updateMock.mockResolvedValueOnce({ ok: false, error: "知识点不存在" } as never);
    expect((await PATCH(req("PATCH", { trackSlug: "python", key: "nope" }))).status).toBe(404);
  });
});
