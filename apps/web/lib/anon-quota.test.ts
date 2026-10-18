import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("./db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "./db";
import { ANON_ROW_LIMIT, ANON_QUOTA_TABLES, assertAnonWriteAllowed, isAnonQuotaTable } from "./anon-quota";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rows: [{ n: 0 }] } as never);
});

describe("assertAnonWriteAllowed", () => {
  it("登录用户不限额、不查库", async () => {
    const r = await assertAnonWriteAllowed({ uid: "u-1", anonId: null }, "log_entries");
    expect(r).toEqual({ ok: true, count: 0, limit: ANON_ROW_LIMIT });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("无匿名设备标识时不在这里拦截（交给 withApi / DB CHECK），不查库", async () => {
    const r = await assertAnonWriteAllowed({ uid: null, anonId: null }, "log_entries");
    expect(r.ok).toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("未达上限 → ok:true 并返回当前行数", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 499 }] } as never);
    const r = await assertAnonWriteAllowed({ uid: null, anonId: "anon-1" }, "log_entries");
    expect(r).toEqual({ ok: true, count: 499, limit: ANON_ROW_LIMIT });
  });

  it("达到上限（>=500）→ ok:false reason:'quota'", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 500 }] } as never);
    const r = await assertAnonWriteAllowed({ uid: null, anonId: "anon-1" }, "log_entries");
    expect(r).toEqual({ ok: false, reason: "quota", count: 500, limit: ANON_ROW_LIMIT });
  });

  it("按 device 维度计数：SQL 只查 user_id IS NULL AND anon_id = 参数", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 0 }] } as never);
    await assertAnonWriteAllowed({ uid: null, anonId: "anon-xyz" }, "certificates");
    const [sql, params] = queryMock.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toBe("SELECT count(*)::int AS n FROM certificates WHERE user_id IS NULL AND anon_id = $1");
    expect(params).toEqual(["anon-xyz"]);
  });

  it("limit 可覆盖", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 6 }] } as never);
    const r = await assertAnonWriteAllowed({ uid: null, anonId: "anon-1" }, "habits", { limit: 5 });
    expect(r).toEqual({ ok: false, reason: "quota", count: 6, limit: 5 });
  });

  it("白名单外的表放行（不是匿名写表，不查库）", async () => {
    expect(isAnonQuotaTable("not_a_table")).toBe(false);
    const r = await assertAnonWriteAllowed({ uid: null, anonId: "anon-1" }, "not_a_table");
    expect(r.ok).toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("配额表清单与迁移 078 的匿名表一致（22 张）", () => {
    expect(ANON_QUOTA_TABLES.length).toBe(22);
    for (const t of ["log_entries", "certificates", "habits", "workouts", "meal_entries"]) {
      expect(isAnonQuotaTable(t)).toBe(true);
    }
  });

  it("DB 异常向上抛（不 fail-open），由 withApi 决定 5xx", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));
    await expect(assertAnonWriteAllowed({ uid: null, anonId: "anon-1" }, "log_entries")).rejects.toThrow("db down");
  });
});
