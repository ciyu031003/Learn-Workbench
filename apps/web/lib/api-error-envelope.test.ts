import { describe, it, expect, vi } from "vitest";
import { apiError, API_ERROR_CODES, dbErrorResponse } from "./api-error";

/**
 * H2 错误 envelope 契约：
 *  - 不传 options → 响应体仍是 `{ error }`（存量接口兼容，见 api-error.test.ts）；
 *  - 传 options → 追加 `code` / `requestId` / `retryAfterSeconds`，供客户端按类型分流。
 */
describe("apiError 错误 envelope（H2）", () => {
  it("不传 options 时保持 { error } 单字段（向后兼容）", async () => {
    const res = apiError(401, "请先登录");
    expect(await res.json()).toEqual({ error: "请先登录" });
  });

  it("传 code / requestId 时追加机器可读字段", async () => {
    const res = apiError(403, "未授权", { code: API_ERROR_CODES.forbidden, requestId: "req-12345678" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "未授权",
      code: "forbidden",
      requestId: "req-12345678",
    });
  });

  it("限流响应带 retryAfterSeconds（0 也要保留）", async () => {
    const body = await apiError(429, "太频繁", {
      code: API_ERROR_CODES.rate_limited,
      retryAfterSeconds: 0,
    }).json();
    expect(body).toMatchObject({ code: "rate_limited", retryAfterSeconds: 0 });
  });

  it("错误码集合是稳定枚举（发布后不可随意改名）", () => {
    expect(Object.values(API_ERROR_CODES).sort()).toEqual(
      ["conflict", "forbidden", "internal_error", "not_found", "rate_limited", "unauthorized", "validation_failed"].sort()
    );
  });

  it("dbErrorResponse 的客户端错误带上 validation_failed，未知错误带 internal_error", async () => {
    const pg = Object.assign(new Error("dup"), { code: "23505" });
    expect(await dbErrorResponse(pg).json()).toMatchObject({ code: "validation_failed" });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dbErrorResponse(new Error("boom")).json()).toMatchObject({ code: "internal_error" });
    spy.mockRestore();
  });

  it("options 的 requestId 能透传到 dbErrorResponse", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await dbErrorResponse(new Error("boom"), "保存失败", { requestId: "req-abcdefgh" }).json();
    expect(body).toMatchObject({ code: "internal_error", requestId: "req-abcdefgh" });
    spy.mockRestore();
  });
});
