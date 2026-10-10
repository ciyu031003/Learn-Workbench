import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("./logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { pgPool } from "./db";
import { logger } from "./logger";
import { listAuditLog, writeAuditLog } from "./audit";

const queryMock = vi.mocked(pgPool.query);
const errorMock = vi.mocked(logger.error);

beforeEach(() => vi.resetAllMocks());

describe("writeAuditLog", () => {
  it("落库字段齐全（actor / action / target / meta / requestId / ip）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await writeAuditLog({
      action: "content.import",
      actorId: "u1",
      actorType: "user",
      targetType: "content_source",
      targetId: "algorithms-java",
      meta: { batchId: 12, dryRun: true },
      requestId: "req-12345678",
      ip: "10.0.0.1",
    });
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain("INSERT INTO audit_log");
    expect(params).toEqual([
      "u1",
      "user",
      "content.import",
      "content_source",
      "algorithms-java",
      JSON.stringify({ batchId: 12, dryRun: true }),
      "req-12345678",
      "10.0.0.1",
    ]);
  });

  it("best-effort：写失败只记 ERROR，不抛（不拖垮业务写）", async () => {
    queryMock.mockRejectedValueOnce(new Error("relation audit_log does not exist"));
    await expect(writeAuditLog({ action: "content.sync" })).resolves.toBeUndefined();
    expect(errorMock).toHaveBeenCalled();
  });

  it("required=true 时写失败要抛（高危操作用）", async () => {
    queryMock.mockRejectedValueOnce(new Error("boom"));
    await expect(writeAuditLog({ action: "role.change", required: true })).rejects.toThrow("boom");
  });

  it("缺省值：actorType=system、meta={}、其余 null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await writeAuditLog({ action: "content.sync" });
    expect(queryMock.mock.calls[0][1]).toEqual([null, "system", "content.sync", null, null, "{}", null, null]);
  });
});

describe("listAuditLog", () => {
  it("limit 夹在 1..500 之间（防一次拉全表）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await listAuditLog({ limit: 99_999 });
    expect(queryMock.mock.calls[0][1]).toEqual([500]);
  });

  it("action / actorId 走参数化 WHERE（不拼字符串）", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    await listAuditLog({ action: "content.import", actorId: "u1", limit: 10 });
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toContain("action = $1");
    expect(String(sql)).toContain("actor_id = $2");
    expect(params).toEqual(["content.import", "u1", 10]);
  });
});
