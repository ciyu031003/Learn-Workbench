import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { pgPool } from "@/lib/db";
import { findRepoRoot, baseEnv, spawnDetached, acquireTaskLock, setTaskPid, failTask } from "./runner";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));

const spawnMock = vi.mocked(spawn);
const existsMock = vi.mocked(existsSync);
const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGDATABASE;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PSQL_BIN;
});

describe("findRepoRoot", () => {
  it("returns the cwd when it holds the marker", () => {
    const base = path.resolve(os.tmpdir(), "repo", "apps", "web");
    const cwdMock = vi.spyOn(process, "cwd").mockReturnValue(base);
    existsMock.mockImplementation((p) => p === path.join(base, "marker.txt"));
    expect(findRepoRoot("marker.txt")).toBe(base);
    cwdMock.mockRestore();
  });

  it("walks up to the parent directory", () => {
    const base = path.resolve(os.tmpdir(), "repo", "apps", "web");
    const parent = path.resolve(base, "..");
    const cwdMock = vi.spyOn(process, "cwd").mockReturnValue(base);
    existsMock.mockImplementation((p) => p === path.join(parent, "marker.txt"));
    expect(findRepoRoot("marker.txt")).toBe(parent);
    cwdMock.mockRestore();
  });

  it("falls back to the grandparent when no marker is found", () => {
    const base = path.resolve(os.tmpdir(), "repo", "apps", "web");
    const grand = path.resolve(base, "..", "..");
    const cwdMock = vi.spyOn(process, "cwd").mockReturnValue(base);
    existsMock.mockImplementation(() => false);
    expect(findRepoRoot("marker.txt")).toBe(grand);
    cwdMock.mockRestore();
  });
});

describe("baseEnv", () => {
  it("uses local PostgreSQL defaults", () => {
    const env = baseEnv();
    expect(env.PGHOST).toBe("127.0.0.1");
    expect(env.PGPORT).toBe("5432");
    expect(env.PGDATABASE).toBe("Learn-Workbench");
    expect(env.PGUSER).toBe("postgres");
    expect(env.PGPASSWORD).toBe("");
    expect(env.PSQL_BIN).toBe("");
  });

  it("overrides defaults from process.env", () => {
    process.env.PGHOST = "db.internal";
    process.env.PGDATABASE = "prod";
    const env = baseEnv();
    expect(env.PGHOST).toBe("db.internal");
    expect(env.PGDATABASE).toBe("prod");
    expect(env.PGPASSWORD).toBe("");
  });
});

describe("spawnDetached", () => {
  it("spawns a detached child and reports its pid", () => {
    const child = { pid: 123, unref: vi.fn() };
    spawnMock.mockReturnValue(child as never);
    const res = spawnDetached("node", ["script.js"], { PGHOST: "x" });
    expect(spawnMock).toHaveBeenCalledWith("node", ["script.js"], {
      env: { PGHOST: "x" },
      detached: true,
      stdio: "ignore",
    });
    expect(child.unref).toHaveBeenCalled();
    expect(res).toEqual({ ok: true, pid: 123 });
  });

  it("returns an error object when spawn throws", () => {
    spawnMock.mockImplementation(() => { throw new Error("spawn failed"); });
    const res = spawnDetached("node", [], {});
    expect(res).toEqual({ ok: false, error: "spawn failed" });
  });
});

describe("acquireTaskLock", () => {
  it("acquires the lock when the insert returns a row", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 9 }] } as never);
    const res = await acquireTaskLock("jobs", "u-1", 60_000);
    expect(res).toEqual({ acquired: true, runId: 9 });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO task_runs"),
      ["jobs", "u-1", 60]
    );
  });

  it("returns a retry window when another instance holds the lock", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ updated_at: new Date(Date.now() - 10_000) }] } as never);
    const res = await acquireTaskLock("jobs", "u-1", 60_000);
    expect(res.acquired).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("computes a safe retry when no prior row exists", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const res = await acquireTaskLock("jobs", "u-1", 60_000);
    expect(res.acquired).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("setTaskPid / failTask", () => {
  it("sets a pid and clears it when omitted", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await setTaskPid(5, 123);
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE task_runs SET pid"),
      [5, 123]
    );
    await setTaskPid(5);
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE task_runs SET pid"),
      [5, null]
    );
  });

  it("marks a task as failed with an error", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await failTask("jobs", "crashed");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      ["jobs", "crashed"]
    );
    await failTask("jobs");
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'failed'"),
      ["jobs", null]
    );
  });
});
