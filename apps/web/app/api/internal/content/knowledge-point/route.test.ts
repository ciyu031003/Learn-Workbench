import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/knowledge-point-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/knowledge-point-write")>();
  return { ...actual, getKnowledgePoint: vi.fn(), updateKnowledgePoint: vi.fn() };
});
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}), listAuditLog: vi.fn() }));

import { getKnowledgePoint, updateKnowledgePoint } from "@/lib/content/knowledge-point-write";
import { writeAuditLog } from "@/lib/audit";
import { GET, POST } from "./route";

const getMock = vi.mocked(getKnowledgePoint);
const updateMock = vi.mocked(updateKnowledgePoint);
const auditMock = vi.mocked(writeAuditLog);

const KEY = "algorithms/ds-sort/ds-insertion-sort";

function post(body: unknown, secret: string | null = "s3cr3t"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-cron-secret"] = secret;
  return new Request("http://localhost/api/internal/content/knowledge-point", {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
}

function get(key: string | null, secret: string | null = "s3cr3t"): Request {
  const headers: Record<string, string> = {};
  if (secret) headers["x-cron-secret"] = secret;
  const url = "http://localhost/api/internal/content/knowledge-point" + (key === null ? "" : `?key=${encodeURIComponent(key)}`);
  return new Request(url, { method: "GET", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
});

describe("GET /api/internal/content/knowledge-point", () => {
  it("无密钥 → 403", async () => {
    expect((await GET(get(KEY, null))).status).toBe(403);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("缺 key → 400", async () => {
    expect((await GET(get(null))).status).toBe(400);
  });

  it("命中 → 返回快照与 version", async () => {
    getMock.mockResolvedValueOnce({
      key: KEY,
      title: "插入排序",
      summary: "",
      status: "published",
      tags: [],
      version: 2,
      updatedAt: null,
      updatedBy: null,
    });
    const res = await GET(get(KEY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ key: KEY, version: 2 });
  });

  it("不存在 → 404", async () => {
    getMock.mockResolvedValueOnce(null);
    expect((await GET(get("ghost"))).status).toBe(404);
  });
});

describe("POST /api/internal/content/knowledge-point", () => {
  it("缺 expectedVersion → 400", async () => {
    expect((await POST(post({ key: KEY, title: "x" }))).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("非法补丁 → 400", async () => {
    const res = await POST(post({ key: KEY, expectedVersion: 1, status: "nope" }));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("乐观锁命中 → 200 并写审计", async () => {
    updateMock.mockResolvedValueOnce({ ok: true, key: KEY, version: 3 });
    const res = await POST(post({ key: KEY, expectedVersion: 2, title: "新标题" }));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: KEY, expectedVersion: 2, patch: { title: "新标题" } })
    );
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "content.knowledge_point_update" }));
    expect(await res.json()).toMatchObject({ ok: true, version: 3 });
  });

  it("版本冲突 → 409 且带上 currentVersion", async () => {
    updateMock.mockResolvedValueOnce({ ok: false, reason: "version_conflict", currentVersion: 7 });
    const res = await POST(post({ key: KEY, expectedVersion: 2, summary: "改摘要" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "conflict", currentVersion: 7 });
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("知识点不存在 → 404", async () => {
    updateMock.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await POST(post({ key: "ghost", expectedVersion: 1, summary: "x" }))).status).toBe(404);
  });
});
