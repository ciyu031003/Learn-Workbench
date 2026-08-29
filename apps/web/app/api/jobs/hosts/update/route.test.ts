import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAdmin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
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
import { acquireTaskLock, baseEnv, failTask, findRepoRoot, setTaskPid, spawnDetached } from "@/lib/tasks/runner";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const isAdminMock = vi.mocked(isAdmin);
const rateLimitMock = vi.mocked(rateLimit);
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
  spawnDetachedMock.mockReturnValue({ ok: true, pid: 7 } as never);
  setTaskPidMock.mockResolvedValue();
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/jobs/hosts/update", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    isAdminMock.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    happy();
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSeconds: 12 });
    const res = await POST();
    expect(res.status).toBe(429);
    expect((await res.json()).retryAfter).toBe(12);
  });

  it("returns 409 when lock is not acquired", async () => {
    happy();
    acquireLockMock.mockResolvedValue({ acquired: false } as never);
    const res = await POST();
    expect(res.status).toBe(409);
  });

  it("starts the hosts update and records pid", async () => {
    happy();
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ started: true });
    expect(setTaskPidMock).toHaveBeenCalledWith(1, 7);
  });

  it("returns 500 when spawn fails", async () => {
    happy();
    spawnDetachedMock.mockReturnValue({ ok: false, error: "no node" } as never);
    const res = await POST();
    expect(res.status).toBe(500);
    expect(failTaskMock).toHaveBeenCalledWith("hosts:update", "no node");
  });
});
