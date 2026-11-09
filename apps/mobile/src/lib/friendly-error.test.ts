import { describe, expect, it } from "vitest";
import { friendlyError, friendlyErrorMessage } from "./friendly-error";

describe("friendlyError", () => {
  it("网络层英文错误统一改成中文提示", () => {
    for (const raw of [
      "Failed to fetch",
      "Network request failed",
      "Load failed",
      "The request timed out",
    ]) {
      expect(friendlyErrorMessage(raw, "加载失败")).toBe("网络连接失败，请检查网络后重试");
    }
  });

  it("5xx 与解析错误不露给用户", () => {
    expect(friendlyErrorMessage("Internal Server Error", "加载失败")).toBe("服务暂时不可用，请稍后重试");
    expect(friendlyErrorMessage("HTTP 502", "加载失败")).toBe("服务暂时不可用，请稍后重试");
    expect(friendlyErrorMessage("Unexpected token < in JSON", "加载失败")).toBe("服务暂时不可用，请稍后重试");
  });

  it("保留站内中文业务提示", () => {
    expect(friendlyError(new Error("昵称需为 1–20 个字符"), "保存失败")).toBe("昵称需为 1–20 个字符");
  });

  it("未知错误/空值回落到中文兜底", () => {
    expect(friendlyError(new Error("TypeError: undefined is not an object"), "保存失败")).toBe("保存失败");
    expect(friendlyError(null, "保存失败")).toBe("保存失败");
    expect(friendlyError(undefined, "保存失败")).toBe("保存失败");
  });
});
