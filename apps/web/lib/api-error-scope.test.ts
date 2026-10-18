import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
import { dbErrorResponse } from "./api-error";

/**
 * S1-7：匿名作用域 CHECK 约束（<table>_scope_required）触发时，
 * 应返回可读的 400「缺少设备标识」而不是笼统的「数值超出允许范围」。
 */
describe("dbErrorResponse · 匿名作用域约束", () => {
  it("maps scope_required check_violation to a readable 400", async () => {
    const res = dbErrorResponse(
      Object.assign(new Error("check violation"), {
        code: "23514",
        constraint: "daily_tasks_scope_required",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("缺少设备标识");
    expect(body.code).toBe("validation_failed");
  });

  it("keeps the generic message for other check violations", async () => {
    const res = dbErrorResponse(
      Object.assign(new Error("range"), { code: "23514", constraint: "some_range_check" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("数值超出允许范围");
  });
});
