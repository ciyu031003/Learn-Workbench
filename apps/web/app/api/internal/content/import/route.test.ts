import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/content/import-pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/import-pipeline")>();
  return {
    ...actual,
    runContentImport: vi.fn(),
    rollbackContentImport: vi.fn(),
  };
});
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}), listAuditLog: vi.fn() }));
import {
  ContentImportError,
  rollbackContentImport,
  runContentImport,
} from "@/lib/content/import-pipeline";
import { POST } from "./route";

const runMock = vi.mocked(runContentImport);
const rollbackMock = vi.mocked(rollbackContentImport);

function req(body: unknown, secret = "s3cr3t"): Request {
  return new Request("http://localhost/api/internal/content/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify(body ?? {}),
  });
}

const okResult = {
  batchId: 7,
  sourceKey: "algorithms-java",
  mode: "dry-run" as const,
  status: "success" as const,
  counts: { new: 2, update: 0, skip: 1, conflict: 0, failed: 0 },
  applied: { new: 0, update: 0, skipped: 1 },
  staged: { questions: 0 },
  commitSha: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  runMock.mockResolvedValue(okResult);
  rollbackMock.mockResolvedValue({ archived: 3, batchId: 7 });
});

describe("POST /api/internal/content/import", () => {
  it("没有 CRON_SECRET 时一律 403", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(req({}))).status).toBe(403);
    process.env.CRON_SECRET = "s3cr3t";
    expect((await POST(req({}, "wrong"))).status).toBe(403);
  });

  it("缺 sourceKey → 400，且不调用导入逻辑", async () => {
    const res = await POST(req({ mode: "apply" }));
    expect(res.status).toBe(400);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("默认 dry-run，mode 只在显式 apply 时物化", async () => {
    await POST(req({ sourceKey: "algorithms-java", items: [{ kind: "knowledge-point", targetKey: "k", title: "t" }] }));
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: "algorithms-java", mode: "dry-run" })
    );
    await POST(req({ sourceKey: "algorithms-java", mode: "apply", commitSha: " abc1234 " }));
    expect(runMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "apply", commitSha: "abc1234" })
    );
  });

  it("scope 只收字符串，非字符串项过滤掉", async () => {
    await POST(req({ sourceKey: "algorithms-java", scope: ["src", 5, null] }));
    expect(runMock).toHaveBeenCalledWith(expect.objectContaining({ scope: ["src"] }));
  });

  it("rollback 走回滚分支，不跑导入", async () => {
    const res = await POST(req({ rollback: 7 }));
    expect(res.status).toBe(200);
    expect(rollbackMock).toHaveBeenCalledWith(7);
    expect(runMock).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ ok: true, rollback: true, archived: 3 });
  });

  it("业务错误按 ContentImportError 的状态码透出", async () => {
    runMock.mockRejectedValue(new ContentImportError("来源未登记：x", "source-not-found", 404));
    const res = await POST(req({ sourceKey: "x" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("来源未登记");
  });

  it("未知错误 → 500，且不泄漏内部细节", async () => {
    runMock.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5432"));
    const res = await POST(req({ sourceKey: "algorithms-java" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("127.0.0.1");
  });
});
