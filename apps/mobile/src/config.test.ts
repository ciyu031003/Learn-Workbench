import { describe, it, expect, vi, beforeEach } from "vitest";

const { getStateMock, extraObj } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  extraObj: { apiUrl: undefined as string | undefined },
}));

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: extraObj } } }));
vi.mock("@/store/app-store", () => ({ useAppStore: { getState: getStateMock } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.EXPO_PUBLIC_API_URL;
  extraObj.apiUrl = undefined;
  getStateMock.mockReturnValue({ apiUrl: undefined as string | undefined });
});

describe("DEFAULT_API_URL", () => {
  it("prefers EXPO_PUBLIC_API_URL", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://env.example.com";
    const { DEFAULT_API_URL } = await import("@/config");
    expect(DEFAULT_API_URL).toBe("https://env.example.com");
  });

  it("falls back to the app.json extra.apiUrl", async () => {
    extraObj.apiUrl = "https://extra.example.com";
    const { DEFAULT_API_URL } = await import("@/config");
    expect(DEFAULT_API_URL).toBe("https://extra.example.com");
  });

  it("falls back to the local dev default", async () => {
    const { DEFAULT_API_URL } = await import("@/config");
    expect(DEFAULT_API_URL).toBe("http://10.0.2.2:3001");
  });
});

describe("getApiUrl", () => {
  it("returns the custom apiUrl trimmed and without trailing slashes", async () => {
    getStateMock.mockReturnValue({ apiUrl: "  https://custom.example.com/  " });
    const { getApiUrl } = await import("@/config");
    expect(getApiUrl()).toBe("https://custom.example.com");
  });

  it("falls back to the default when the custom value is blank", async () => {
    getStateMock.mockReturnValue({ apiUrl: "   " });
    const mod = await import("@/config");
    expect(mod.getApiUrl()).toBe(mod.DEFAULT_API_URL);
  });

  it("falls back to the default when no custom value is set", async () => {
    getStateMock.mockReturnValue({ apiUrl: undefined });
    const mod = await import("@/config");
    expect(mod.getApiUrl()).toBe(mod.DEFAULT_API_URL);
  });
});

/**
 * v4 P2（决策 D7）：正式包禁明文。
 * 背景：包内 `usesCleartextTraffic=false`，任何 http:// 请求都会被系统直接拒绝，
 * 而这类失败在 UI 上曾被统一报成「当前网络不可用」，把排查方向完全带偏。
 */
describe("sanitizeApiUrl", () => {
  it("https 地址保留（去掉结尾斜杠）", async () => {
    const { sanitizeApiUrl } = await import("@/config");
    expect(sanitizeApiUrl("https://learn.yuanabd.cn/")).toBe("https://learn.yuanabd.cn");
  });

  it("空值回落生产域名", async () => {
    const { sanitizeApiUrl, PRODUCTION_API_URL } = await import("@/config");
    expect(sanitizeApiUrl("   ")).toBe(PRODUCTION_API_URL);
  });

  it("__DEV__ 未定义/为 true（联调）时仍允许 http", async () => {
    const { sanitizeApiUrl } = await import("@/config");
    expect(sanitizeApiUrl("http://10.0.2.2:3001")).toBe("http://10.0.2.2:3001");
  });

  it("正式包（__DEV__=false）把 http 强制换成生产 https", async () => {
    vi.stubGlobal("__DEV__", false);
    vi.resetModules();
    const { sanitizeApiUrl, PRODUCTION_API_URL } = await import("@/config");
    expect(sanitizeApiUrl("http://evil.example.com")).toBe(PRODUCTION_API_URL);
    expect(sanitizeApiUrl("https://ok.example.com")).toBe("https://ok.example.com");
    vi.unstubAllGlobals();
  });
});
