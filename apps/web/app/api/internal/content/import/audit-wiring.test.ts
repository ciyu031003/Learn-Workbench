import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/import-pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/import-pipeline")>();
  return { ...actual, runContentImport: vi.fn(), rollbackContentImport: vi.fn() };
});
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(async () => {}), listAuditLog: vi.fn() }));

import { rollbackContentImport, runContentImport } from "@/lib/content/import-pipeline";
import { writeAuditLog } from "@/lib/audit";
import { POST } from "./route";

const runMock = vi.mocked(runContentImport);
const rollbackMock = vi.mocked(rollbackContentImport);
const auditMock = vi.mocked(writeAuditLog);

function req(body: unknown): Request {
  return new Request("http://localhost/api/internal/content/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": "s3cr3t", "x-request-id": "req-audit-0001" },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  runMock.mockResolvedValue({
    batchId: 11,
    sourceKey: "algorithms-java",
    mode: "apply",
    status: "success",
    counts: { new: 2, update: 0, skip: 0, conflict: 0, failed: 0 },
    applied: { new: 2, update: 0, skipped: 0 },
    staged: { questions: 0 },
    commitSha: "abc1234",
  } as never);
  rollbackMock.mockResolvedValue({ archived: 2, batchId: 11 } as never);
});

describe("内容导入/回滚的审计留痕（H3）", () => {
  it("导入成功 → 写 content.import 审计，带 actor/批次/请求 id", async () => {
    await POST(req({ sourceKey: "algorithms-java", mode: "apply", commitSha: "abc1234" }));
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "content.import",
        actorType: "cron",
        targetType: "content_source",
        targetId: "algorithms-java",
        requestId: "req-audit-0001",
        meta: expect.objectContaining({ mode: "apply", batchId: 11 }),
      })
    );
  });

  it("回滚 → 写 content.import.rollback 审计，target 是批次", async () => {
    await POST(req({ rollback: 11 }));
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "content.import.rollback",
        targetType: "content_import_batch",
        targetId: "11",
      })
    );
  });

  it("被拒绝的请求（错密钥）不留审计（没发生就是没发生）", async () => {
    const bad = new Request("http://localhost/api/internal/content/import", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
      body: JSON.stringify({ sourceKey: "x" }),
    });
    expect((await POST(bad)).status).toBe(403);
    expect(auditMock).not.toHaveBeenCalled();
  });
});
