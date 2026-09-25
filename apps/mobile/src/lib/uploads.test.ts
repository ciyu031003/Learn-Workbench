import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 34 } }));
vi.mock("@/config", () => ({ getApiUrl: () => "https://learn.yuanabd.cn" }));
vi.mock("@/store/app-store", () => ({ useAppStore: { getState: vi.fn(() => ({ token: "tok-1" })) } }));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: vi.fn(),
}));

import { absoluteMediaUrl, kindFromGearLabel, needsMediaLibraryPermission, normalizeImageMime } from "./uploads";

/**
 * 回归：真机「上传证件照失败」。服务端只认 jpeg/png/webp/heic/heif，
 * 而选择器偶尔给空 mimeType 或 image/jpg —— 上传前必须归一，否则被 400 掉。
 */
describe("normalizeImageMime", () => {
  it("别名归一（image/jpg → image/jpeg）", () => {
    expect(normalizeImageMime("image/jpg", "file:///a/b.jpg")).toBe("image/jpeg");
    expect(normalizeImageMime("IMAGE/JPG", "file:///a/b.jpg")).toBe("image/jpeg");
    expect(normalizeImageMime("image/x-png", "file:///a/b.png")).toBe("image/png");
  });
  it("空值按扩展名兜底", () => {
    expect(normalizeImageMime(null, "file:///a/b.png")).toBe("image/png");
    expect(normalizeImageMime(undefined, "file:///a/b.webp")).toBe("image/webp");
    expect(normalizeImageMime("", "file:///a/b.HEIC")).toBe("image/heic");
    expect(normalizeImageMime(null, "file:///a/b.heif")).toBe("image/heif");
  });
  it("不认识的类型回落 jpeg（宁可错类型也别被 400）", () => {
    expect(normalizeImageMime("application/octet-stream", "file:///a/b.bin")).toBe("image/jpeg");
    expect(normalizeImageMime("image/gif", "file:///a/b.gif")).toBe("image/jpeg");
  });
  it("合法类型原样通过", () => {
    expect(normalizeImageMime("image/webp", "file:///a/b.webp")).toBe("image/webp");
    expect(normalizeImageMime("image/jpeg", "file:///a/b.jpg")).toBe("image/jpeg");
  });
});

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
