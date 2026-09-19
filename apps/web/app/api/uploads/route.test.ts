import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/uploads")>();
  return { ...actual, processAndStoreImage: vi.fn(), removeUploadFile: vi.fn() };
});

import { pgPool } from "@/lib/db";
import { currentUserId, currentSessionToken } from "@/lib/session";
import { processAndStoreImage, removeUploadFile } from "@/lib/uploads";
import { POST, DELETE } from "./route";

const queryMock = vi.mocked(pgPool.query);
const tokenMock = vi.mocked(currentSessionToken);
const userMock = vi.mocked(currentUserId);
const storeMock = vi.mocked(processAndStoreImage);
const removeMock = vi.mocked(removeUploadFile);

const USER_ID = "11111111-2222-3333-4444-555555555555";

function uploadRequest(file: Blob | null, kind = "racket") {
  const form = new FormData();
  if (file) form.append("file", file);
  form.append("kind", kind);
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
    const big = new File([new Uint8Array(9 * 1024 * 1024)], "big.png", { type: "image/png" });
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
