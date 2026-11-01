import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("@/lib/background/bing", () => ({ getBackgroundImage: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { getBackgroundImage } from "@/lib/background/bing";
import { GET } from "./route";

const imageMock = vi.mocked(getBackgroundImage);
let tmpRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-bgimg-"));
});

afterEach(() => {
  cwdSpy?.mockRestore();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const req = (query: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/background/img" + query, { headers });

describe("GET /api/background/img（DB 优先 + assets 回退）", () => {
  it("日期格式错误返回 400", async () => {
    const res = await GET(req("?date=13-08-2026"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date 格式应为 YYYY-MM-DD" });
  });

  it("库里有图时直接流式返回，带 ETag/Cache-Control/Content-Length", async () => {
    imageMock.mockResolvedValueOnce({
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      mime: "image/jpeg",
      md5: "m1",
      updatedAt: new Date("2026-08-13T01:00:00Z"),
    });
    const res = await GET(req("?date=2026-08-13"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Length")).toBe("4");
    expect(res.headers.get("ETag")).toBe('"m1"');
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(new Uint8Array(await res.arrayBuffer()).length).toBe(4);
  });

  it("If-None-Match 命中时返回 304", async () => {
    imageMock.mockResolvedValueOnce({
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      mime: "image/jpeg",
      md5: "m1",
      updatedAt: new Date("2026-08-13T01:00:00Z"),
    });
    const res = await GET(req("?date=2026-08-13", { "if-none-match": '"m1"' }));
    expect(res.status).toBe(304);
  });

  it("库里没有且没有 assets 目录返回 404", async () => {
    imageMock.mockResolvedValueOnce(null);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(tmpRoot, "nested"));
    expect((await GET(req("?date=2026-08-13"))).status).toBe(404);
  });

  it("库里没有且文件缺失返回 404", async () => {
    imageMock.mockResolvedValueOnce(null);
    fs.mkdirSync(path.join(tmpRoot, "assets", "backgrounds", "bing"), { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    expect((await GET(req("?date=2026-08-13"))).status).toBe(404);
  });

  it("库里没有时回退本地 jpg（保留 200/缓存头）", async () => {
    imageMock.mockResolvedValueOnce(null);
    const bgDir = path.join(tmpRoot, "assets", "backgrounds", "bing");
    fs.mkdirSync(bgDir, { recursive: true });
    fs.writeFileSync(path.join(bgDir, "2026-08-13.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    const res = await GET(req("?date=2026-08-13"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect((await res.arrayBuffer()).byteLength).toBe(4);
  });

  it("读库异常时回退本地文件", async () => {
    imageMock.mockRejectedValueOnce(new Error("db down"));
    const bgDir = path.join(tmpRoot, "assets", "backgrounds", "bing");
    fs.mkdirSync(bgDir, { recursive: true });
    fs.writeFileSync(path.join(bgDir, "2026-08-13.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    expect((await GET(req("?date=2026-08-13"))).status).toBe(200);
  });
});
