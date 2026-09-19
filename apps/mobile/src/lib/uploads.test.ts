import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 34 } }));
vi.mock("@/config", () => ({ getApiUrl: () => "https://learn.yuanabd.cn" }));
vi.mock("@/store/app-store", () => ({ useAppStore: { getState: vi.fn(() => ({ token: "tok-1" })) } }));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: vi.fn(),
}));

import { absoluteMediaUrl, kindFromGearLabel, needsMediaLibraryPermission } from "./uploads";

describe("kindFromGearLabel", () => {
  it("按中文标签猜类别（拍 / 鞋 / 线 / 手胶 / 球）", () => {
    expect(kindFromGearLabel("球拍型号")).toBe("racket");
    expect(kindFromGearLabel("底板")).toBe("racket");
    expect(kindFromGearLabel("球鞋类型")).toBe("shoes");
    expect(kindFromGearLabel("拍线")).toBe("string");
    expect(kindFromGearLabel("磅数")).toBe("string");
    expect(kindFromGearLabel("手胶")).toBe("grip");
    expect(kindFromGearLabel("比赛用球")).toBe("ball");
    expect(kindFromGearLabel("护具")).toBe("other");
  });
});

describe("needsMediaLibraryPermission", () => {
  it("Android 13+ 用系统相册选择器，不需要读相册权限", () => {
    expect(needsMediaLibraryPermission("android", 33)).toBe(false);
    expect(needsMediaLibraryPermission("android", 34)).toBe(false);
    expect(needsMediaLibraryPermission("android", "35")).toBe(false);
  });

  it("Android 12 及以下仍要 READ_EXTERNAL_STORAGE，iOS 不请求", () => {
    expect(needsMediaLibraryPermission("android", 32)).toBe(true);
    expect(needsMediaLibraryPermission("android", 29)).toBe(true);
    expect(needsMediaLibraryPermission("ios", 17)).toBe(false);
    expect(needsMediaLibraryPermission("android", "abc")).toBe(false);
  });
});

describe("absoluteMediaUrl", () => {
  it("相对路径补上 apiUrl；绝对地址原样返回；空值返回 null", () => {
    expect(absoluteMediaUrl("/uploads/u/a.webp")).toBe("https://learn.yuanabd.cn/uploads/u/a.webp");
    expect(absoluteMediaUrl("https://cdn.example.com/a.webp")).toBe("https://cdn.example.com/a.webp");
    expect(absoluteMediaUrl(null)).toBeNull();
    expect(absoluteMediaUrl("  ")).toBeNull();
  });
});
