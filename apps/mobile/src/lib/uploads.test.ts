import { describe, it, expect, vi, beforeEach } from "vitest";

const mem = vi.hoisted(() => ({ data: {} as Record<string, string> }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.data[k] ?? null,
    setItem: async (k: string, v: string) => {
      mem.data[k] = v;
    },
    removeItem: async (k: string) => {
      delete mem.data[k];
    },
  },
}));

vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 34 } }));
vi.mock("@/config", () => ({ getApiUrl: () => "https://learn.yuanabd.cn" }));
vi.mock("@/store/app-store", () => ({ useAppStore: { getState: vi.fn(() => ({ token: "tok-1" })) } }));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: vi.fn(),
}));

const net = vi.hoisted(() => ({ type: "WIFI" as string, reachable: true as boolean | undefined }));
vi.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", WIFI: "WIFI", CELLULAR: "CELLULAR" },
  getNetworkStateAsync: async () => ({ type: net.type, isInternetReachable: net.reachable }),
}));

const fsMock = vi.hoisted(() => ({ deleted: [] as string[] }));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  getInfoAsync: async () => ({ exists: true }),
  makeDirectoryAsync: async () => undefined,
  copyAsync: async () => undefined,
  deleteAsync: async (uri: string) => {
    fsMock.deleted.push(uri);
  },
}));

import {
  absoluteMediaUrl,
  kindFromGearLabel,
  needsMediaLibraryPermission,
  normalizeImageMime,
  pickAndUploadPhoto,
  uploadImage,
} from "./uploads";
import { loadOutbox, UPLOAD_OUTBOX_KEY } from "./upload-outbox";
import * as ImagePicker from "expo-image-picker";

const launchMock = vi.mocked(ImagePicker.launchImageLibraryAsync);

beforeEach(() => {
  mem.data = {};
  fsMock.deleted = [];
  net.type = "WIFI";
  net.reachable = true;
  launchMock.mockReset();
});

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

describe("uploadImage", () => {
  it("成功后返回站内路径与上传 id，并携带登录 token", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ upload: { url: "/uploads/u/a.webp", id: 12 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImage("avatar", { uri: "file:///a.jpg", mimeType: "image/jpeg" })
    ).resolves.toEqual({ url: "/uploads/u/a.webp", id: 12 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://learn.yuanabd.cn/api/uploads");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer tok-1" });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("kind")).toBe("avatar");
  });

  it("失败时优先抛出服务端错误，无结构化错误时使用兜底文案", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "文件过大" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImage("avatar", { uri: "file:///a.jpg", mimeType: "image/jpeg" })
    ).rejects.toThrow("文件过大");
    await expect(
      uploadImage("avatar", { uri: "file:///a.jpg", mimeType: "image/jpeg" })
    ).rejects.toThrow("上传失败，请重试");
  });

  it("带 clientId 时一并提交（服务端据此去重，离线补发不落两份）", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({ upload: { url: "/uploads/u/a.webp", id: 3 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadImage("avatar", { uri: "file:///a.jpg", mimeType: "image/jpeg" }, "c-9");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.body as FormData).get("clientId")).toBe("c-9");

    fetchMock.mockClear();
    await uploadImage("avatar", { uri: "file:///a.jpg", mimeType: "image/jpeg" });
    expect((fetchMock.mock.calls[0][1] as RequestInit).body as FormData).toBeInstanceOf(FormData);
    expect(((fetchMock.mock.calls[0][1] as RequestInit).body as FormData).get("clientId")).toBeNull();
  });
});

/**
 * 组一 · 阶段 1：图片上传发件箱。
 * 旧链路「选图 → 直接 POST」在离线/5xx/杀进程时会把用户选好的图丢掉。
 */
describe("pickAndUploadPhoto", () => {
  it("用户取消：返回 canceled，不落盘不入队", async () => {
    launchMock.mockResolvedValueOnce({ canceled: true, assets: null } as never);
    await expect(pickAndUploadPhoto("avatar")).resolves.toEqual({ status: "canceled" });
    expect(mem.data[UPLOAD_OUTBOX_KEY]).toBeUndefined();
  });

  it("在线成功：返回服务端 url，队列清空并删掉本机副本", async () => {
    launchMock.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "content://media/1", mimeType: "image/png" }],
    } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ upload: { url: "/uploads/u/a.webp", id: 4 } }) }))
    );

    await expect(pickAndUploadPhoto("avatar")).resolves.toEqual({
      status: "uploaded",
      url: "/uploads/u/a.webp",
    });
    expect((await loadOutbox()).ops).toHaveLength(0);
    expect(fsMock.deleted.some((u) => u.includes("pending-uploads/"))).toBe(true);
  });

  it("离线：先落本机并排队，返回 queued（重启后仍能补发）", async () => {
    launchMock.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "content://media/2", mimeType: "image/jpeg" }],
    } as never);
    net.type = "NONE";
    net.reachable = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed");
      })
    );

    const result = await pickAndUploadPhoto("racket");
    expect(result.status).toBe("queued");
    if (result.status !== "queued") throw new Error("unreachable");
    expect(result.localUri.startsWith("file:///doc/pending-uploads/")).toBe(true);
    const queued = await loadOutbox();
    expect(queued.ops).toHaveLength(1);
    expect(queued.ops[0]).toMatchObject({ clientId: result.clientId, kind: "racket", mimeType: "image/jpeg" });
  });

  it("4xx（格式/容量/校验）：丢弃并抛错，队列不留毒丸", async () => {
    launchMock.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "content://media/3", mimeType: "image/jpeg" }],
    } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: "文件太大了" }) }))
    );

    await expect(pickAndUploadPhoto("avatar")).rejects.toThrow("文件太大了");
    expect((await loadOutbox()).ops).toHaveLength(0);
  });
});
