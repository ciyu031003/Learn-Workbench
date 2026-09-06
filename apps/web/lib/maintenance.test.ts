import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("./db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("./logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { pgPool } from "./db";
import { logger } from "./logger";
import { cleanupExpiredData, securityAlerts } from "./maintenance";

const queryMock = vi.mocked(pgPool.query);
const warnMock = vi.mocked(logger.warn);

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rowCount: 3, rows: [] } as never);
});

describe("cleanupExpiredData", () => {
  it("runs all cleanup statements and reports row counts", async () => {
    const r = await cleanupExpiredData();
    expect(r).toEqual({ sessions: 3, authAttempts: 3, resetTokens: 3, syncChanges: 3 });
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(String(queryMock.mock.calls[0][0])).toContain("DELETE FROM sessions");
  });

  it("keeps going when one statement fails", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));
    const r = await cleanupExpiredData();
    expect(r.sessions).toBe(0);
    expect(r.authAttempts).toBe(3);
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
