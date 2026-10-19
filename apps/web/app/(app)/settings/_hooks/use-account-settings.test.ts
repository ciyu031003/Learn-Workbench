import { describe, expect, it, vi } from "vitest";
import { submitPasswordChange, validatePasswordChange, type PasswordChangeInput } from "./use-account-settings";

const valid: PasswordChangeInput = { current: "old-pass", next: "NewPass123", confirm: "NewPass123" };

describe("useAccountSettings 的校验/请求函数（S6-4）", () => {
  it("validatePasswordChange：缺字段 / 不一致 / 太短 / 太长", () => {
    expect(validatePasswordChange({ current: "", next: "NewPass123", confirm: "NewPass123" })).toBe("请填写完整");
    expect(validatePasswordChange({ ...valid, confirm: "OtherPass123" })).toBe("两次输入的新密码不一致");
    expect(validatePasswordChange({ ...valid, next: "short", confirm: "short" })).toBe("新密码至少 8 位");
    expect(validatePasswordChange({ ...valid, next: "a".repeat(129), confirm: "a".repeat(129) })).toBe("密码最多 128 位");
  });

  it("validatePasswordChange：合法输入返回 null", () => {
    expect(validatePasswordChange(valid)).toBeNull();
  });

  it("submitPasswordChange：本地校验失败不发起请求", async () => {
    const fetcher = vi.fn();
    const result = await submitPasswordChange(fetcher, { current: "", next: "", confirm: "" });
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("submitPasswordChange：后端 ok → 成功；错误文案原样透出", async () => {
    const okFetcher = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }) as unknown as Response);
    await expect(submitPasswordChange(okFetcher, valid)).resolves.toEqual({ ok: true, message: "密码修改成功" });
    const badFetcher = vi.fn(async () => ({ ok: false, json: async () => ({ error: "当前密码错误" }) }) as unknown as Response);
    await expect(submitPasswordChange(badFetcher, valid)).resolves.toEqual({ ok: false, message: "当前密码错误" });
  });

  it("submitPasswordChange：网络异常降级为可读文案", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(submitPasswordChange(fetcher, valid)).resolves.toEqual({ ok: false, message: "网络异常，请稍后重试" });
  });
});
