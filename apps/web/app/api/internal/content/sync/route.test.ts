import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/content/knowledge-model", () => ({
  buildContentSyncPlan: vi.fn(),
  readContentPackageVersion: vi.fn(),
  syncKnowledgeModel: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}), listAuditLog: vi.fn() }));
import {
  buildContentSyncPlan,
  readContentPackageVersion,
  syncKnowledgeModel,
} from "@/lib/content/knowledge-model";
import { POST } from "./route";

const planMock = vi.mocked(buildContentSyncPlan);
const versionMock = vi.mocked(readContentPackageVersion);
const syncMock = vi.mocked(syncKnowledgeModel);

function req(body: unknown, secret = "s3cr3t"): Request {
  return new Request("http://localhost/api/internal/content/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify(body ?? {}),
  });
}

const emptyResult = {
  inserted: 0,
  updated: 0,
  unchanged: 84,
  archived: 0,
  links: 168,
  relations: 105,
  prerequisites: 21,
  unlinkedQuestions: 160,
  contentVersion: "abc1234",
  stalePoints: 0,
  stats: {} as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  versionMock.mockReturnValue({ version: "abc1234", updatedAt: "2026-10-01T00:00:00.000Z" });
  planMock.mockReturnValue({ points: [], links: [], relations: [], prerequisites: [], unlinkedQuestions: [], stats: {} as never, contentVersion: "abc1234", contentUpdatedAt: null, reviewTtlDays: 180 });
  syncMock.mockResolvedValue(emptyResult);
});

describe("POST /api/internal/content/sync", () => {
  it("没有 CRON_SECRET 时一律 403（含空 secret）", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(req({}))).status).toBe(403);
    process.env.CRON_SECRET = "s3cr3t";
    expect((await POST(req({}, "wrong"))).status).toBe(403);
  });

  it("默认取 git 内容包版本，并把统计原样回报", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(planMock).toHaveBeenCalledWith({
      contentVersion: "abc1234",
      contentUpdatedAt: "2026-10-01T00:00:00.000Z",
      reviewTtlDays: undefined,
    });
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, dryRun: false, inserted: 0, unchanged: 84, links: 168, archived: 0 });
  });

  it("显式传版本/复查周期时以入参为准，dryRun 透传", async () => {
    await POST(req({ contentVersion: "deadbee", contentUpdatedAt: "2026-09-01T00:00:00.000Z", reviewTtlDays: 30, dryRun: true }));
    expect(planMock).toHaveBeenCalledWith({
      contentVersion: "deadbee",
      contentUpdatedAt: "2026-09-01T00:00:00.000Z",
      reviewTtlDays: 30,
    });
    expect(syncMock).toHaveBeenCalledWith(expect.anything(), { dryRun: true });
  });

  it("同步抛错 → 500，且不泄漏内部错误详情", async () => {
    syncMock.mockRejectedValue(new Error("connection refused: 127.0.0.1"));
    const res = await POST(req({}));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("127.0.0.1");
  });
});
