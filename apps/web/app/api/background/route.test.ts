import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("@/lib/background/bing", () => ({ getBackgroundSummary: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { getBackgroundSummary } from "@/lib/background/bing";
import { logger } from "@/lib/logger";
import { GET } from "./route";

const summaryMock = vi.mocked(getBackgroundSummary);
const warnMock = vi.mocked(logger.warn);
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
  vi.clearAllMocks();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lwb-bg-"));
});

afterEach(() => {
  vi.useRealTimers();
  cwdSpy?.mockRestore();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("GET /api/background（DB 优先 + assets 回退）", () => {
  it("库里有图时直接返回今日/最近一张（exists:true, source:db）", async () => {
    summaryMock.mockResolvedValueOnce({
      date: "2026-08-13",
      remoteUrl: "https://www.bing.com/x.jpg",
      copyright: "版权",
      width: 1920,
      height: 1080,
      mime: "image/jpeg",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      date: "2026-08-13",
      file: "2026-08-13.jpg",
      exists: true,
      mime: "image/jpeg",
      source: "db",
    });
    expect(summaryMock).toHaveBeenCalledWith(TODAY);
  });

  it("库里没有时回退 assets 清单（今日优先）", async () => {
    summaryMock.mockResolvedValueOnce(null);
    setup(tmpRoot, makeManifest({ [TODAY]: { file: TODAY + ".jpg" } }), [TODAY + ".jpg"]);
    const res = await GET();
    expect(await res.json()).toMatchObject({
      date: TODAY,
      file: TODAY + ".jpg",
      exists: true,
      source: "file",
    });
  });

  it("读库异常时也回退 assets 并记录 warn", async () => {
    summaryMock.mockRejectedValueOnce(new Error("db down"));
    setup(tmpRoot, makeManifest({ [TODAY]: { file: TODAY + ".jpg" } }), [TODAY + ".jpg"]);
    const res = await GET();
    expect((await res.json()).exists).toBe(true);
    expect(warnMock).toHaveBeenCalled();
  });

  it("库空且清单里有过去日期时取最近一天", async () => {
    summaryMock.mockResolvedValueOnce(null);
    setup(
      tmpRoot,
      makeManifest({
        "2026-08-10": { file: "2026-08-10.jpg" },
        "2026-08-12": { file: "2026-08-12.jpg" },
        "2026-08-14": { file: "2026-08-14.jpg" },
      }),
    );
    expect((await (await GET()).json()).date).toBe("2026-08-12");
  });

  it("库空且清单为空时返回 null file", async () => {
    summaryMock.mockResolvedValueOnce(null);
    setup(tmpRoot, makeManifest({}));
    expect(await (await GET()).json()).toEqual({
      date: TODAY,
      file: null,
      exists: false,
      source: "none",
    });
  });

  it("库空且找不到 assets 目录时返回 null file", async () => {
    summaryMock.mockResolvedValueOnce(null);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(tmpRoot, "nested"));
    expect(await (await GET()).json()).toEqual({
      date: TODAY,
      file: null,
      exists: false,
      source: "none",
    });
  });
});
