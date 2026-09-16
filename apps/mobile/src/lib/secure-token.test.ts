import { afterEach, describe, expect, it, vi } from "vitest";

const getItemAsync = vi.fn();
vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => getItemAsync(...args),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const { secureToken } = await import("./secure-token");

describe("secureToken.loadWithTimeout", () => {
  afterEach(() => {
    getItemAsync.mockReset();
    vi.useRealTimers();
  });

  it("正常返回 token", async () => {
    getItemAsync.mockResolvedValue("tok-123");
    await expect(secureToken.loadWithTimeout(1000)).resolves.toBe("tok-123");
  });

  it("原生读取抛错时按未登录处理（不冒泡）", async () => {
    getItemAsync.mockRejectedValue(new Error("keystore boom"));
    await expect(secureToken.loadWithTimeout(1000)).resolves.toBeNull();
  });

  it("原生读取卡住（ColorOS Keystore 已知问题）时按未登录返回，不会拖住启动", async () => {
    vi.useFakeTimers();
    getItemAsync.mockReturnValue(new Promise(() => {})); // 永不 resolve
    const p = secureToken.loadWithTimeout(3000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBeNull();
  });

  it("超时前返回时不会被超时覆盖", async () => {
    vi.useFakeTimers();
    getItemAsync.mockResolvedValue("fast");
    const p = secureToken.loadWithTimeout(3000);
    await expect(p).resolves.toBe("fast");
  });
});
