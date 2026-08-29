import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { poolMock, setTypeParser } = vi.hoisted(() => ({
  poolMock: vi.fn(),
  setTypeParser: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: poolMock,
  types: { setTypeParser },
}));

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>).lwbPgPool;
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGDATABASE;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
});

describe("lib/db", () => {
  it("registers the date type parser", async () => {
    const mod = await import("@/lib/db");
    expect(setTypeParser).toHaveBeenCalledWith(1082, expect.any(Function));
    expect(mod.pgPool).toBeDefined();
  });

  it("creates a Pool with default local config", async () => {
    const mod = await import("@/lib/db");
    expect(poolMock).toHaveBeenCalledWith({
      host: "127.0.0.1",
      port: 5432,
      database: "Learn-Workbench",
      user: "postgres",
      max: 10,
      connectionTimeoutMillis: 5000,
    });
    expect(mod.pgPool).toBe(poolMock.mock.results[0].value);
  });

  it("honours PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD env overrides", async () => {
    process.env.PGHOST = "10.0.0.1";
    process.env.PGPORT = "5433";
    process.env.PGDATABASE = "other";
    process.env.PGUSER = "admin";
    process.env.PGPASSWORD = "secret";
    const { pgPool } = await import("@/lib/db");
    expect(poolMock).toHaveBeenCalledWith({
      host: "10.0.0.1",
      port: 5433,
      database: "other",
      user: "admin",
      max: 10,
      connectionTimeoutMillis: 5000,
      password: "secret",
    });
    expect(pgPool).toBeDefined();
  });

  it("does not include password when PGPASSWORD is unset", async () => {
    const { pgPool } = await import("@/lib/db");
    const cfg = poolMock.mock.calls[0][0];
    expect(cfg).not.toHaveProperty("password");
    expect(pgPool).toBeDefined();
  });

  it("reuses the global pool across module re-imports", async () => {
    const a = await import("@/lib/db");
    poolMock.mockClear();
    const b = await import("@/lib/db");
    expect(poolMock).not.toHaveBeenCalled();
    expect(a.pgPool).toBe(b.pgPool);
  });
});
