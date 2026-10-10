import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/config", () => ({ getApiUrl: () => "https://example.test" }));

import { EMPTY_UPLOAD_OUTBOX, enqueue, loadOutbox, makeUploadOp, saveOutbox, type UploadOp } from "./upload-outbox";
import { flushUploadOutbox, onUploadResolved, sendUploadOp } from "./upload-sync";

function op(clientId: string): UploadOp {
  return makeUploadOp({
    clientId,
    kind: "avatar",
    fileUri: "file:///doc/pending-uploads/" + clientId + ".jpg",
    mimeType: "image/jpeg",
  });
}

type FakeResponse = { status: number; ok?: boolean; error?: string; upload?: { url: string; id: number } };

function mockFetch(impl: (url: string, init: RequestInit) => FakeResponse | "throw") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const r = impl(String(url), init);
      if (r === "throw") throw new TypeError("Network request failed");
      return {
        ok: r.ok ?? (r.status >= 200 && r.status < 300),
        status: r.status,
        json: async () => (r.upload ? { upload: r.upload } : r.error ? { error: r.error } : {}),
      } as unknown as Response;
    })
  );
}

beforeEach(() => {
  mem.data = {};
  fsMock.deleted = [];
  net.type = "WIFI";
  net.reachable = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendUploadOp", () => {
  it("成功：multipart 带上 kind 与 clientId，返回站内 url 与 id", async () => {
    mockFetch((url, init) => {
      expect(url).toBe("https://example.test/api/uploads");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
      const form = init.body as FormData;
      expect(form.get("kind")).toBe("avatar");
      expect(form.get("clientId")).toBe("c-1");
      return { status: 201, upload: { url: "/uploads/u/a.webp", id: 5 } };
    });

    await expect(sendUploadOp(op("c-1"), "tok-1")).resolves.toEqual({
      ok: true,
      url: "/uploads/u/a.webp",
      id: 5,
    });
  });

  it("4xx → client（重试永远不会成功）；5xx → server；401 → auth", async () => {
    mockFetch(() => ({ status: 400, error: "文件过大" }));
    await expect(sendUploadOp(op("c-1"), "t")).resolves.toEqual({
      ok: false,
      outcome: { ok: false, kind: "client", status: 400, message: "文件过大" },
    });

    mockFetch(() => ({ status: 503 }));
    await expect(sendUploadOp(op("c-1"), "t")).resolves.toMatchObject({
      ok: false,
      outcome: { kind: "server", status: 503 },
    });

    mockFetch(() => ({ status: 401 }));
    await expect(sendUploadOp(op("c-1"), "t")).resolves.toMatchObject({ ok: false, outcome: { kind: "auth" } });
  });

  it("连不上：按设备是否在线区分 offline / server（不误报「没网」）", async () => {
    net.type = "NONE";
    net.reachable = false;
    mockFetch(() => "throw");
    await expect(sendUploadOp(op("c-1"), "t")).resolves.toMatchObject({ ok: false, outcome: { kind: "offline" } });

    net.type = "WIFI";
    net.reachable = true;
    await expect(sendUploadOp(op("c-1"), "t")).resolves.toMatchObject({ ok: false, outcome: { kind: "server" } });
  });
});

describe("flushUploadOutbox", () => {
  it("离线时保留队列、不抛错；联网重试成功后出队、删本机副本并回填 url", async () => {
    await saveOutbox(enqueue(EMPTY_UPLOAD_OUTBOX, op("c-1")));

    net.type = "NONE";
    net.reachable = false;
    mockFetch(() => "throw");
    expect(await flushUploadOutbox("t")).toMatchObject({ sent: 0, remaining: 1 });
    expect((await loadOutbox()).ops).toHaveLength(1);

    net.type = "WIFI";
    net.reachable = true;
    const events: string[] = [];
    const off = onUploadResolved((e) => events.push(e.clientId + "→" + e.url));
    mockFetch(() => ({ status: 201, upload: { url: "/uploads/u/a.webp", id: 7 } }));

    expect(await flushUploadOutbox("t")).toMatchObject({ sent: 1, dropped: 0, remaining: 0 });
    expect((await loadOutbox()).ops).toHaveLength(0);
    expect(events).toEqual(["c-1→/uploads/u/a.webp"]);
    expect(fsMock.deleted).toContain("file:///doc/pending-uploads/c-1.jpg");
    off();
  });

  it("毒丸（4xx）丢弃后继续处理后面的，不会堵住队首", async () => {
    let state = enqueue(EMPTY_UPLOAD_OUTBOX, op("bad"));
    state = enqueue(state, op("good"));
    await saveOutbox(state);

    mockFetch((url, init) => {
      const clientId = (init.body as FormData).get("clientId");
      if (clientId === "bad") return { status: 400, error: "非法格式" };
      return { status: 201, upload: { url: "/uploads/u/good.webp", id: 8 } };
    });

    expect(await flushUploadOutbox("t")).toMatchObject({ sent: 1, dropped: 1, remaining: 0 });
    expect((await loadOutbox()).ops).toHaveLength(0);
    // 两条的临时文件都清了（丢弃的也要清，避免占空间）
    expect(fsMock.deleted).toContain("file:///doc/pending-uploads/bad.jpg");
    expect(fsMock.deleted).toContain("file:///doc/pending-uploads/good.jpg");
  });

  it("401（未登录）按可重试处理：保留队列等登录后补发", async () => {
    await saveOutbox(enqueue(EMPTY_UPLOAD_OUTBOX, op("c-1")));
    mockFetch(() => ({ status: 401 }));
    expect(await flushUploadOutbox(null)).toMatchObject({ sent: 0, dropped: 0, remaining: 1 });
  });
});
