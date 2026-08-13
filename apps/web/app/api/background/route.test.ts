import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "./route";

const TODAY = "2026-08-13";
let tmpRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

function makeManifest(entries: Record<string, { file: string }>) {
  const index: Record<string, unknown> = {};
  for (const [date, { file }] of Object.entries(entries)) {
    index[date] = { file, remote_url: "https://x", copyright: "c", width: 1920, height: 1080, md5: "m" };
  }
  return JSON.stringify(index);
}

function setup(cwd: string, manifest: string, files: string[] = []) {
  const bgDir = path.join(cwd, "assets", "backgrounds", "bing");
  fs.mkdirSync(bgDir, { recursive: true });
  fs.writeFileSync(path.join(bgDir, "index.json"), manifest, "utf8");
  for (const f of files) fs.writeFileSync(path.join(bgDir, f), "fake-jpg", "utf8");
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(cwd);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 13, 10, 0, 0));
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-bg-"));
});

afterEach(() => {
  vi.useRealTimers();
  cwdSpy?.mockRestore();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("GET /api/background", () => {
  it("returns today's entry when present and the file exists", async () => {
    setup(tmpRoot, makeManifest({ [TODAY]: { file: TODAY + ".jpg" } }), [TODAY + ".jpg"]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      date: TODAY,
      file: TODAY + ".jpg",
      exists: true,
      width: 1920,
      height: 1080,
    });
  });

  it("falls back to the nearest past date when today is missing", async () => {
    setup(tmpRoot, makeManifest({
      "2026-08-10": { file: "2026-08-10.jpg" },
      "2026-08-12": { file: "2026-08-12.jpg" },
      "2026-08-14": { file: "2026-08-14.jpg" },
    }));
    const res = await GET();
    const json = await res.json();
    expect(json.date).toBe("2026-08-12");
  });

  it("reports exists:false when the file is missing", async () => {
    setup(tmpRoot, makeManifest({ [TODAY]: { file: TODAY + ".jpg" } }), []);
    const res = await GET();
    expect((await res.json()).exists).toBe(false);
  });

  it("returns a null file when the manifest is empty", async () => {
    setup(tmpRoot, makeManifest({}));
    const res = await GET();
    expect(await res.json()).toEqual({ date: TODAY, file: null, exists: false });
  });

  it("returns a null file when no background dir exists", async () => {
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(tmpRoot, "nested"));
    const res = await GET();
    expect(await res.json()).toEqual({ date: TODAY, file: null, exists: false });
  });
});
