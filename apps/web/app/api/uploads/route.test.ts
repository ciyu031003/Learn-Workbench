import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/uploads")>();
  return { ...actual, processAndStoreImage: vi.fn(), removeUploadFile: vi.fn() };
});

import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { processAndStoreImage, removeUploadFile, UPLOAD_MAX_BYTES } from "@/lib/uploads";
import { POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const tokenMock = vi.mocked(currentSessionToken);
const userMock = vi.mocked(currentUserId);
const storeMock = vi.mocked(processAndStoreImage);
const removeMock = vi.mocked(removeUploadFile);

const USER_ID = "11111111-2222-3333-4444-555555555555";

function uploadRequest(file: Blob | null, kind = "racket", clientId?: string) {
  const form = new FormData();
  if (file) form.append("file", file);
  form.append("kind", kind);
  if (clientId) form.append("clientId", clientId);
  return new Request("http://localhost/api/uploads", { method: "POST", body: form });
}

beforeEach(() => {
  vi.resetAllMocks();
  tokenMock.mockResolvedValue("tok-1");
  userMock.mockResolvedValue(USER_ID);
  queryMock.mockResolvedValue({ rows: [{ count: "0", bytes: "0" }] } as never);
  storeMock.mockResolvedValue({
    path: USER_ID + "/abc.webp",
    url: "/uploads/" + USER_ID + "/abc.webp",
    bytes: 12345,
    width: 1200,
    height: 900,
  });
});

describe("POST /api/uploads", () => {
  it("未登录返回 401", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await POST(uploadRequest(new File(["x"], "a.png", { type: "image/png" })));
    expect(res.status).toBe(401);
  });

  it("缺少文件返回 400", async () => {
    const res = await POST(uploadRequest(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("缺少图片文件");
  });

  it("不支持的格式返回 400", async () => {
    const res = await POST(uploadRequest(new File(["x"], "a.gif", { type: "image/gif" })));
    expect(res.status).toBe(400);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it("超过单张上限返回 400", async () => {
    // 从常量推导：上限调整（8MB→12MB）时这条用例不会变成假绿
    const big = new File([new Uint8Array(UPLOAD_MAX_BYTES + 1)], "big.png", { type: "image/png" });
    const res = await POST(uploadRequest(big));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("太大了");
  });

  it("数量达上限返回 429", async () => {
    queryMock.mockResolvedValue({ rows: [{ count: "200", bytes: "1000" }] } as never);
    const res = await POST(uploadRequest(new File(["x"], "a.png", { type: "image/png" })));
    expect(res.status).toBe(429);
  });

  it("成功：压缩落盘 + 写 uploads 表 + 返回站内相对 url", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: "0", bytes: "0" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 7 }] } as never);
    const res = await POST(uploadRequest(new File(["abc"], "a.png", { type: "image/png" }), "avatar"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.upload).toMatchObject({ id: 7, kind: "avatar", bytes: 12345, width: 1200 });
    expect(body.upload.url).toBe("/uploads/" + USER_ID + "/abc.webp");
    expect(storeMock).toHaveBeenCalledWith(USER_ID, "avatar", expect.anything());
    expect(String(queryMock.mock.calls[1][0])).toContain("INSERT INTO uploads");
  });

  it("非法 kind 归一到 other", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: "0", bytes: "0" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 8 }] } as never);
    await POST(uploadRequest(new File(["abc"], "a.png", { type: "image/png" }), "not-a-kind"));
    expect(storeMock).toHaveBeenCalledWith(USER_ID, "other", expect.anything());
  });

  it("带 clientId 首次上传：INSERT 带上 clientId", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never) // 幂等查询：没有已存在记录
      .mockResolvedValueOnce({ rows: [{ count: "0", bytes: "0" }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 9 }] } as never);
    const res = await POST(uploadRequest(new File(["abc"], "a.png", { type: "image/png" }), "avatar", "c-1"));
    expect(res.status).toBe(201);
    const insertCall = queryMock.mock.calls[2] as unknown as [string, unknown[]];
    expect(String(insertCall[0])).toContain("client_id");
    expect(insertCall[1][6]).toBe("c-1");
  });

  it("同一 clientId 重复提交（离线补发）：回已存在记录，不落盘、不占配额", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 42, kind: "racket", path: USER_ID + "/old.webp", bytes: 999, width: 800, height: 600 }],
    } as never);
    const res = await POST(uploadRequest(new File(["abc"], "a.png", { type: "image/png" }), "racket", "c-dup"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upload).toMatchObject({ id: 42, kind: "racket", bytes: 999, width: 800 });
    expect(body.upload.url).toBe("/uploads/" + USER_ID + "/old.webp");
    // 只打了一条幂等查询，没有配额查询、没有落盘、没有再 INSERT
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it("并发重复补发撞唯一索引（23505）：回查已有记录返回 200", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never) // 首次幂等查询未命中
      .mockResolvedValueOnce({ rows: [{ count: "0", bytes: "0" }] } as never)
      .mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }))
      .mockResolvedValueOnce({
        rows: [{ id: 43, kind: "racket", path: USER_ID + "/race.webp", bytes: 111, width: 640, height: 480 }],
      } as never);
    const res = await POST(uploadRequest(new File(["abc"], "a.png", { type: "image/png" }), "racket", "c-race"));
    expect(res.status).toBe(200);
    expect((await res.json()).upload.id).toBe(43);
  });

  it("图片处理失败返回 400", async () => {
    storeMock.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(uploadRequest(new File(["x"], "a.png", { type: "image/png" })));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/uploads", () => {
  it("未登录返回 401", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/uploads?url=/uploads/x/y.webp"));
    expect(res.status).toBe(401);
  });

  it("别人的图片返回 403", async () => {
    const others = "/uploads/99999999-2222-3333-4444-555555555555/abc.webp";
    const res = await DELETE(new Request("http://localhost/api/uploads?url=" + encodeURIComponent(others)));
    expect(res.status).toBe(403);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("路径穿越返回 403", async () => {
    const evil = "/uploads/" + USER_ID + "/../../etc/passwd";
    const res = await DELETE(new Request("http://localhost/api/uploads?url=" + encodeURIComponent(evil)));
    expect(res.status).toBe(403);
  });

  it("删除自己的图片：软删 + 清磁盘，且接受完整 URL", async () => {
    const full = "https://learn.yuanabd.cn/uploads/" + USER_ID + "/abc.webp";
    const res = await DELETE(new Request("http://localhost/api/uploads?url=" + encodeURIComponent(full)));
    expect(res.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith(USER_ID + "/abc.webp");
    expect(String(queryMock.mock.calls[0][0])).toContain("UPDATE uploads SET deleted_at");
  });
});
