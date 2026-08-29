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
