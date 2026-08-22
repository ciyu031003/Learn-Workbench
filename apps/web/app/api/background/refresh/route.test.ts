import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));

import { execFile } from "node:child_process";
import { currentUserId } from "@/lib/session";
import { POST } from "./route";

const execFileMock = vi.mocked(execFile);
const currentUserIdMock = vi.mocked(currentUserId);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

function runCrawler(success: boolean) {
  (
    execFileMock as unknown as {
      mockImplementation: (fn: (...args: unknown[]) => unknown) => void;
    }
  ).mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as (
      err: Error | null,
      stdout?: string,
      stderr?: string
    ) => void;
    if (success) cb(null, "[ok] 已保存 2026-08-14.jpg\n[done] 完成：2026-08-14", "");
    else cb(new Error("boom"), "", "error");
    return undefined;
  });
}

describe("POST /api/background/refresh", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns ok=true when the crawler succeeds", async () => {
    runCrawler(true);
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(String(json.output)).toContain("完成");
  });

  it("returns ok=false when the crawler fails", async () => {
    runCrawler(false);
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
  });
});