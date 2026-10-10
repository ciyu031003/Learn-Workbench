import { beforeEach, describe, expect, it, vi } from "vitest";

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

const fsMock = vi.hoisted(() => ({
  documentDirectory: "file:///doc/",
  copied: [] as { from: string; to: string }[],
  deleted: [] as string[],
  failCopy: false,
}));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: fsMock.documentDirectory,
  getInfoAsync: async () => ({ exists: true }),
  makeDirectoryAsync: async () => undefined,
  copyAsync: async ({ from, to }: { from: string; to: string }) => {
    if (fsMock.failCopy) throw new Error("copy failed");
    fsMock.copied.push({ from, to });
  },
  deleteAsync: async (uri: string) => {
    fsMock.deleted.push(uri);
  },
}));

import {
  EMPTY_UPLOAD_OUTBOX,
  UPLOAD_OUTBOX_KEY,
  enqueue,
  extForMime,
  findByClientId,
  isLocalFileUri,
  loadOutbox,
  makeClientId,
  makeUploadOp,
  pendingCount,
  peek,
  pendingUploadDir,
  persistPickedImage,
  removeByClientId,
  removeByUri,
  removeLocalFile,
  saveOutbox,
  dequeue,
} from "./upload-outbox";

function op(clientId: string, fileUri = "file:///doc/pending-uploads/" + clientId + ".jpg") {
  return makeUploadOp({ clientId, kind: "avatar", fileUri, mimeType: "image/jpeg", displayUri: "file:///cache/a.jpg" });
}

beforeEach(() => {
  mem.data = {};
  fsMock.copied = [];
  fsMock.deleted = [];
  fsMock.failCopy = false;
});

describe("makeUploadOp / makeClientId", () => {
  it("clientId 可外部指定（persist 需要先用它命名文件），否则随机生成且唯一", () => {
    expect(op("c-1").clientId).toBe("c-1");
    const a = makeClientId();
    const b = makeClientId();
    expect(a).not.toBe(b);
    expect(a.startsWith("img-")).toBe(true);
  });

  it("displayUri 缺省回落到 fileUri（乐观展示用）", () => {
    const made = makeUploadOp({ kind: "racket", fileUri: "file:///doc/x.jpg", mimeType: "image/jpeg" });
    expect(made.displayUri).toBe("file:///doc/x.jpg");
  });
});

describe("queue 纯函数", () => {
  it("入队保持顺序，同 clientId 覆盖（避免同一张图补发两次）", () => {
    let state = EMPTY_UPLOAD_OUTBOX;
    state = enqueue(state, op("c-1"));
    state = enqueue(state, op("c-2"));
    expect(pendingCount(state)).toBe(2);
    expect(peek(state)?.clientId).toBe("c-1");

    state = enqueue(state, { ...op("c-1"), kind: "shoes" });
    expect(pendingCount(state)).toBe(2);
    expect(findByClientId(state, "c-1")?.kind).toBe("shoes");
    expect(peek(state)?.clientId).toBe("c-1");
  });

  it("dequeue / removeByClientId / removeByUri 都能取回被丢弃项（用来删本机文件）", () => {
    const a = op("c-1", "file:///doc/pending-uploads/c-1.jpg");
    const b = op("c-2", "file:///doc/pending-uploads/c-2.jpg");
    const state = enqueue(enqueue(EMPTY_UPLOAD_OUTBOX, a), b);

    expect(dequeue(state, a.opId).ops.map((o) => o.clientId)).toEqual(["c-2"]);

    const byClient = removeByClientId(state, "c-1");
    expect(byClient.removed?.clientId).toBe("c-1");
    expect(byClient.state.ops.map((o) => o.clientId)).toEqual(["c-2"]);

    const byUri = removeByUri(state, "file:///doc/pending-uploads/c-2.jpg");
    expect(byUri.removed.map((o) => o.clientId)).toEqual(["c-2"]);
    expect(byUri.state.ops.map((o) => o.clientId)).toEqual(["c-1"]);

    // 用 clientId 当引用也能命中（屏幕只持有 clientId 时）
    expect(removeByUri(state, "c-1").removed.map((o) => o.clientId)).toEqual(["c-1"]);
    expect(removeByUri(state, "nope").removed).toEqual([]);
  });
});

describe("isLocalFileUri / extForMime", () => {
  it("本机临时地址都要拦（否则本机路径会被写进数据库）", () => {
    expect(isLocalFileUri("file:///doc/a.jpg")).toBe(true);
    expect(isLocalFileUri("content://media/1")).toBe(true);
    expect(isLocalFileUri("ph://ABC")).toBe(true);
    expect(isLocalFileUri("assets-library://x")).toBe(true);
    expect(isLocalFileUri("/uploads/u/a.webp")).toBe(false);
    expect(isLocalFileUri("https://learn.yuanabd.cn/uploads/u/a.webp")).toBe(false);
    expect(isLocalFileUri(null)).toBe(false);
  });

  it("扩展名与 mime 一致（服务端按 type 校验）", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/heic")).toBe("heic");
    expect(extForMime("image/heif")).toBe("heic");
    expect(extForMime("image/jpeg")).toBe("jpg");
  });
});

describe("持久化", () => {
  it("保存到 AsyncStorage；队列清空时删除键", async () => {
    await saveOutbox(enqueue(EMPTY_UPLOAD_OUTBOX, op("c-1")));
    expect(mem.data[UPLOAD_OUTBOX_KEY]).toContain("c-1");
    expect((await loadOutbox()).ops).toHaveLength(1);

    await saveOutbox(EMPTY_UPLOAD_OUTBOX);
    expect(mem.data[UPLOAD_OUTBOX_KEY]).toBeUndefined();
    expect((await loadOutbox()).ops).toHaveLength(0);
  });

  it("损坏的存储内容按空队列处理（不抛错）", async () => {
    mem.data[UPLOAD_OUTBOX_KEY] = "{not json";
    expect(await loadOutbox()).toEqual(EMPTY_UPLOAD_OUTBOX);
    mem.data[UPLOAD_OUTBOX_KEY] = JSON.stringify({ ops: "nope" });
    expect(await loadOutbox()).toEqual(EMPTY_UPLOAD_OUTBOX);
  });

  it("选中的图会复制到 document 目录（不受系统清缓存影响），失败时降级返回原 uri", async () => {
    const dest = await persistPickedImage("content://media/1", "image/png", "c-9");
    expect(dest).toBe(pendingUploadDir() + "c-9.png");
    expect(fsMock.copied).toEqual([{ from: "content://media/1", to: dest }]);

    fsMock.failCopy = true;
    expect(await persistPickedImage("content://media/2", "image/jpeg", "c-10")).toBe("content://media/2");
  });

  it("removeLocalFile 只删本机地址（站内/绝对 url 不误删）", async () => {
    await removeLocalFile("file:///doc/pending-uploads/c-1.jpg");
    await removeLocalFile("https://learn.yuanabd.cn/uploads/u/a.webp");
    await removeLocalFile("/uploads/u/a.webp");
    expect(fsMock.deleted).toEqual(["file:///doc/pending-uploads/c-1.jpg"]);
  });
});
