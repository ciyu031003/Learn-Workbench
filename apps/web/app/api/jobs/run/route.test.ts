import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAdmin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/http", () => ({ parseBody: vi.fn() }));
vi.mock("@/lib/tasks/runner", () => ({
  acquireTaskLock: vi.fn(),
  baseEnv: vi.fn(),
  failTask: vi.fn(),
  findRepoRoot: vi.fn(),
  setTaskPid: vi.fn(),
  spawnDetached: vi.fn(),
}));

import { currentUserId } from "@/lib/session";
import { isAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/http";
import { acquireTaskLock, baseEnv, failTask, findRepoRoot, setTaskPid, spawnDetached } from "@/lib/tasks/runner";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const isAdminMock = vi.mocked(isAdmin);
const rateLimitMock = vi.mocked(rateLimit);
const parseBodyMock = vi.mocked(parseBody);
const acquireLockMock = vi.mocked(acquireTaskLock);
const baseEnvMock = vi.mocked(baseEnv);
const failTaskMock = vi.mocked(failTask);
const findRepoRootMock = vi.mocked(findRepoRoot);
const setTaskPidMock = vi.mocked(setTaskPid);
const spawnDetachedMock = vi.mocked(spawnDetached);

function happy() {
  currentUserIdMock.mockResolvedValue("u-1");
  isAdminMock.mockResolvedValue(true);
  rateLimitMock.mockReturnValue({ ok: true, retryAfterSeconds: 0 });
  findRepoRootMock.mockReturnValue("/repo");
  baseEnvMock.mockReturnValue({});
  acquireLockMock.mockResolvedValue({ acquired: true, runId: 1 } as never);
  spawnDetachedMock.mockReturnValue({ ok: true, pid: 123 } as never);
  setTaskPidMock.mockResolvedValue();
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.JOBS_LIMIT;
});

describe("POST /api/jobs/run", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    isAdminMock.mockResolvedValue(false);
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    happy();
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSeconds: 30 });
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(429);
    expect((await res.json()).retryAfter).toBe(30);
  });

  it("returns 400 when body is unparseable", async () => {
    happy();
    parseBodyMock.mockResolvedValue({ ok: false, status: 413, error: "请求体过大" });
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(413);
  });

  it("returns 400 for invalid scope", async () => {
    happy();
    parseBodyMock.mockResolvedValue({ ok: true, data: { scope: "other" } });
    const res = await POST(jsonReq({ scope: "other" }));
    expect(res.status).toBe(400);
  });

  it("starts both engines for scope=all", async () => {
    happy();
    parseBodyMock.mockResolvedValue({ ok: true, data: { scope: "all" } });
    const res = await POST(jsonReq({ scope: "all" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.started).toBe(true);
    expect(body.engines).toHaveLength(2);
    expect(body.engines.every((e: { started: boolean }) => e.started)).toBe(true);
    expect(setTaskPidMock).toHaveBeenCalledTimes(2);
  });

  it("starts a single engine for scope=official", async () => {
    happy();
    parseBodyMock.mockResolvedValue({ ok: true, data: { scope: "official" } });
    const res = await POST(jsonReq({ scope: "official" }));
    expect(res.status).toBe(200);
    expect((await res.json()).engines).toHaveLength(1);
  });

  it("returns 409 when all engines fail to start", async () => {
    happy();
    acquireLockMock.mockResolvedValue({ acquired: false } as never);
    parseBodyMock.mockResolvedValue({ ok: true, data: { scope: "all" } });
    const res = await POST(jsonReq({ scope: "all" }));
    expect(res.status).toBe(409);
  });

  it("records a failed engine when spawn fails", async () => {
    happy();
    spawnDetachedMock.mockReturnValue({ ok: false, error: "spawn failed" } as never);
    parseBodyMock.mockResolvedValue({ ok: true, data: { scope: "official" } });
    const res = await POST(jsonReq({ scope: "official" }));
    expect(res.status).toBe(409);
    expect(failTaskMock).toHaveBeenCalledWith("crawler:official", "spawn failed");
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
