import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("./db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("./logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// 诊断包的 fs 清理/总览与 SQL 清理无关：测试里 mock 掉，保持用例确定性（不碰真实目录）
// vi.mock 工厂会被提升到文件顶部，mock 句柄必须用 vi.hoisted 创建
const { pruneMock, summarizeMock } = vi.hoisted(() => ({
  pruneMock: vi.fn(async () => ({ files: 0, dirs: 0 })),
  summarizeMock: vi.fn(async () => ({ total: 0, last24h: 0, devices24h: 0, parsed: 0, byVersion: {} })),
}));
vi.mock("./diagnostics-store", () => ({
  pruneDiagnosticReports: pruneMock,
  summarizeDiagnosticReports: summarizeMock,
}));
import { pgPool } from "./db";
import { logger } from "./logger";
import { ANON_TABLES } from "./anon-tables";
import {
  cleanupExpiredData,
  securityAlerts,
  DIAGNOSTIC_ALERT_DEVICES,
  ANON_CLEANUP_ORDER,
  ANON_CLEANUP_TS_COLUMN,
  ANON_RETENTION_DAYS,
} from "./maintenance";

const queryMock = vi.mocked(pgPool.query);
const warnMock = vi.mocked(logger.warn);

/** 原有 4 条审计/会话清理 SQL（在匿名清理之前执行） */
const BASE_CLEANUP_COUNT = 4;

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rowCount: 3, rows: [] } as never);
});

describe("cleanupExpiredData", () => {
  it("runs all cleanup statements and reports row counts", async () => {
    const r = await cleanupExpiredData();
    // v1.34.0：CleanupResult 增加 diagnosticFiles；S2-8：增加 anonRows（22 张匿名表 × rowCount 3）
    expect(r).toEqual({
      sessions: 3,
      authAttempts: 3,
      resetTokens: 3,
      syncChanges: 3,
      anonRows: 3 * ANON_CLEANUP_ORDER.length,
      diagnosticFiles: 0,
    });
    expect(queryMock).toHaveBeenCalledTimes(BASE_CLEANUP_COUNT + ANON_CLEANUP_ORDER.length);
    expect(String(queryMock.mock.calls[0][0])).toContain("DELETE FROM sessions");
    // v1.35.0：两个诊断任务确实被调用（保留策略 30 天 + 崩溃率总览）
    expect(pruneMock).toHaveBeenCalledWith(30);
    expect(summarizeMock).toHaveBeenCalledTimes(1);
  });

  it("匿名清理只删 180 天未更新的匿名行，表名/时间列来自常量、窗口走参数", async () => {
    await cleanupExpiredData();
    const anonCalls = queryMock.mock.calls.slice(BASE_CLEANUP_COUNT);
    expect(anonCalls).toHaveLength(ANON_CLEANUP_ORDER.length);
    for (let i = 0; i < anonCalls.length; i += 1) {
      const [sql, params] = anonCalls[i] as unknown as [string, unknown[]];
      const table = ANON_CLEANUP_ORDER[i];
      expect(sql).toContain("DELETE FROM " + table);
      expect(sql).toContain("user_id IS NULL AND anon_id IS NOT NULL");
      expect(sql).toContain(ANON_CLEANUP_TS_COLUMN[table]);
      expect(sql).toContain("make_interval(days => $1)");
      expect(params).toEqual([ANON_RETENTION_DAYS]);
      expect(ANON_RETENTION_DAYS).toBe(180);
    }
  });

  it("匿名表清单全覆盖：迁移 078 的 22 张表都有时间列且都在删除顺序里", () => {
    expect(ANON_TABLES.length).toBe(22);
    expect(ANON_CLEANUP_ORDER.length).toBe(ANON_TABLES.length);
    for (const table of ANON_TABLES) {
      expect(ANON_CLEANUP_TS_COLUMN[table]).toBeTruthy();
      expect(ANON_CLEANUP_ORDER).toContain(table);
    }
    // 子表先于父表（focus_sessions.task_id → daily_tasks）
    expect(ANON_CLEANUP_ORDER.indexOf("focus_sessions")).toBeLessThan(ANON_CLEANUP_ORDER.indexOf("daily_tasks"));
  });

  it("keeps going when one statement fails", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));
    const r = await cleanupExpiredData();
    expect(r.sessions).toBe(0);
    expect(r.authAttempts).toBe(3);
    expect(warnMock).toHaveBeenCalled();
  });

  it("单张匿名表失败不影响其它表（anonRows 只累计成功的表）", async () => {
    queryMock.mockImplementation(((sql: string) => {
      if (String(sql).includes("DELETE FROM checkins")) return Promise.reject(new Error("boom"));
      return Promise.resolve({ rowCount: 2, rows: [] });
    }) as never);
    const r = await cleanupExpiredData();
    expect(r.anonRows).toBe(2 * (ANON_CLEANUP_ORDER.length - 1));
    expect(warnMock).toHaveBeenCalledWith("[maintenance] anon cleanup failed:", "checkins", expect.anything());
  });

  it("alerts when deduped devices reach the threshold (v1.35.0：按设备去重后的真实告警)", async () => {
    summarizeMock.mockResolvedValueOnce({
      total: 12,
      last24h: 12,
      devices24h: DIAGNOSTIC_ALERT_DEVICES,
      parsed: 12,
      byVersion: { "1.35.0": 12 },
    });
    await cleanupExpiredData();
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("诊断包"));
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("台设备"));
  });

  it("does not alert on single-user upload bursts (文件数够多但设备数不够)", async () => {
    summarizeMock.mockResolvedValueOnce({
      total: 18,
      last24h: 18,
      devices24h: 1,
      parsed: 18,
      byVersion: { "1.35.0": 18 },
    });
    await cleanupExpiredData();
    expect(warnMock).not.toHaveBeenCalledWith(expect.stringContaining("诊断包"));
  });

  it("keeps going when diagnostics fs tasks fail (prune/summarize 抛错不炸 cron)", async () => {
    pruneMock.mockRejectedValueOnce(new Error("fs down"));
    summarizeMock.mockRejectedValueOnce(new Error("fs down"));
    const r = await cleanupExpiredData();
    expect(r.diagnosticFiles).toBe(0);
    expect(r.sessions).toBe(3); // SQL 清理不受影响
    expect(warnMock).toHaveBeenCalled();
  });
});

describe("securityAlerts", () => {
  it("reports snapshot without alerting under thresholds", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 10, users: 3 }] } as never)
      .mockResolvedValueOnce({ rows: [{ username: "bob", n: 5 }] } as never);
    const r = await securityAlerts();
    expect(r).toEqual({
      failed24h: 10,
      distinctUsernames: 3,
      topUsername: "bob",
      topUsernameCount: 5,
      alerted: false,
    });
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("alerts when the total failure volume exceeds the threshold", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 300, users: 40 }] } as never)
      .mockResolvedValueOnce({ rows: [{ username: "admin", n: 12 }] } as never);
    const r = await securityAlerts();
    expect(r.alerted).toBe(true);
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("异常登录失败量"));
  });

  it("alerts when a single username is hammered", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 40, users: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ username: "victim", n: 35 }] } as never);
    const r = await securityAlerts();
    expect(r.alerted).toBe(true);
  });

  it("tolerates db failures and empty result sets", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    const r = await securityAlerts();
    expect(r).toMatchObject({ failed24h: 0, alerted: false });
    expect(warnMock).toHaveBeenCalled();
  });
});
