import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "./route";

let tmpRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-bgimg-"));
});

afterEach(() => {
  cwdSpy?.mockRestore();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("GET /api/background/img", () => {
  it("returns 400 for an invalid date format", async () => {
    const res = await GET(new Request("http://localhost/api/background/img?date=13-08-2026"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date 格式应为 YYYY-MM-DD" });
  });

  it("returns 404 when the background dir does not exist", async () => {
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(tmpRoot, "nested"));
    const res = await GET(new Request("http://localhost/api/background/img?date=2026-08-13"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the image file is missing", async () => {
    const bgDir = path.join(tmpRoot, "assets", "backgrounds", "bing");
    fs.mkdirSync(bgDir, { recursive: true });
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    const res = await GET(new Request("http://localhost/api/background/img?date=2026-08-13"));
    expect(res.status).toBe(404);
  });

  it("serves the jpeg with cache headers", async () => {
    const bgDir = path.join(tmpRoot, "assets", "backgrounds", "bing");
    fs.mkdirSync(bgDir, { recursive: true });
    fs.writeFileSync(path.join(bgDir, "2026-08-13.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    const res = await GET(new Request("http://localhost/api/background/img?date=2026-08-13"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBe(4);
  });
});
