import { describe, it, expect, vi } from "vitest";
import { apiError, dbErrorResponse, PG_ERROR_MESSAGE_MAP } from "./api-error";

/**
 * 写接口错误映射契约（2026-09-15 加固）
 *
 * 目标：客户端数据引发的数据库约束问题 → 4xx；服务端未知错误 → 结构化 500（带日志）。
 */
const pgError = (code: string, message = "db error") => Object.assign(new Error(message), { code });

describe("dbErrorResponse", () => {
  it("CHECK 约束冲突 → 400，提示范围", async () => {
    const res = dbErrorResponse(pgError("23514"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("数值超出允许范围");
  });

  it("唯一键冲突 → 400（同名记录）", async () => {
    const res = dbErrorResponse(pgError("23505"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("同名");
  });

  it("外键/非空/格式/数值越界都能翻译", () => {
    for (const code of ["23503", "23502", "22P02", "22003"]) {
      expect(PG_ERROR_MESSAGE_MAP[code]).toBeTruthy();
      expect(dbErrorResponse(pgError(code)).status).toBe(400);
    }
  });

  it("未知错误 → 结构化 500，且打印服务端日志（不裸抛）", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = dbErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("非对象异常（字符串/undefined）也安全", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dbErrorResponse("oops").status).toBe(500);
    expect(dbErrorResponse(undefined).status).toBe(500);
    spy.mockRestore();
  });

  it("可自定义兜底文案", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = dbErrorResponse(new Error("boom"), "记不住这条了，请重试");
    expect((await res.json()).error).toBe("记不住这条了，请重试");
    spy.mockRestore();
  });
});

describe("apiError", () => {
  it("统一 { error } 结构", async () => {
    const res = apiError(401, "请先登录");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "请先登录" });
  });
});
