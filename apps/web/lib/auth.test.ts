import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/anon", () => ({ getAnonId: vi.fn() }));
import { pgPool } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { clientIp, isAdmin, recordLoginFailure, recordLoginSuccess, loginLocked, claimAnonData, anonScopeValue } from "./auth";

const queryMock = vi.mocked(pgPool.query);
const connectMock = vi.mocked(pgPool.connect);
const userIdMock = vi.mocked(currentUserId);
const getAnonIdMock = vi.mocked(getAnonId);

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rows: [] } as never);
  userIdMock.mockResolvedValue("u-1");
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("returns unknown when no headers are present", () => {
    expect(clientIp(new Request("http://localhost"))).toBe("unknown");
  });
});

describe("isAdmin", () => {
  it("returns false for an anonymous user", async () => {
    expect(await isAdmin(null)).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns true when the user is an admin", async () => {
    queryMock.mockResolvedValue({ rows: [{ is_admin: true }] } as never);
    expect(await isAdmin("u-1")).toBe(true);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM users"), ["u-1"]);
  });

  it("returns false when the user is not an admin", async () => {
    queryMock.mockResolvedValue({ rows: [{ is_admin: false }] } as never);
    expect(await isAdmin("u-1")).toBe(false);
  });

  it("returns false when the user row is missing", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    expect(await isAdmin("u-missing")).toBe(false);
  });
});

describe("login attempt recording", () => {
  it("records a login failure", async () => {
    await recordLoginFailure("bob", "1.1.1.1");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO auth_attempts"),
      ["bob", "1.1.1.1"]
    );
  });

  it("records a login success and clears prior failures", async () => {
    await recordLoginSuccess("bob", "1.1.1.1");
    const inserts = queryMock.mock.calls.filter((c) => String(c[0]).includes("INSERT INTO auth_attempts"));
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual(["bob", "1.1.1.1"]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM auth_attempts"),
      ["bob"]
    );
  });
});

describe("loginLocked", () => {
  it("is not locked below the failure threshold", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 2, last: new Date() }] } as never);
    const res = await loginLocked("bob", { maxFailures: 5, windowMs: 60_000 });
    expect(res).toEqual({ locked: false, retryAfterSeconds: 0 });
  });

  it("locks when failures reach the threshold", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 5, last: new Date(Date.now() - 5000) }] } as never);
    const res = await loginLocked("bob", { maxFailures: 5, windowMs: 60_000 });
    expect(res.locked).toBe(true);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps a safe retry when no last attempt time exists", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 9, last: null }] } as never);
    const res = await loginLocked("bob");
    expect(res.locked).toBe(true);
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("claimAnonData", () => {
  function makeClient(rejectUpdate = false) {
    const client = {
      query: vi.fn((sql: string) => {
        if (rejectUpdate && String(sql).includes("UPDATE")) return Promise.reject(new Error("db down"));
        if (String(sql).includes("UPDATE")) return Promise.resolve({ rowCount: 2 });
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
      release: vi.fn(),
    };
    return client;
  }

  it("claims only the current device rows", async () => {
    const client = makeClient();
    connectMock.mockResolvedValue(client as never);
    const claimed = await claimAnonData("u-1", { anonId: "dev-1" });
    expect(claimed).toBe(16); // 8 tables × 2 rows
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
    const calls = client.query.mock.calls as unknown as [string, unknown[]][];
    const updates = calls.filter((c) => String(c[0]).includes("UPDATE"));
    expect(updates.every((c) => c[1]?.[0] === "u-1" && c[1]?.[1] === "dev-1")).toBe(true);
  });

  it("also claims legacy rows when claimLegacy is enabled", async () => {
    const client = makeClient();
    connectMock.mockResolvedValue(client as never);
    const claimed = await claimAnonData("u-1", { anonId: "dev-1", claimLegacy: true });
    expect(claimed).toBe(32); // 8 device + 8 legacy × 2 rows
    const updates = client.query.mock.calls.filter((c) => String(c[0]).includes("UPDATE"));
    expect(updates).toHaveLength(16);
  });

  it("rolls back and rethrows on failure", async () => {
    const client = makeClient(true);
    connectMock.mockResolvedValue(client as never);
    await expect(claimAnonData("u-1", { anonId: "dev-1" })).rejects.toThrow("db down");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("anonScopeValue", () => {
  it("returns null when the user is logged in", async () => {
    userIdMock.mockResolvedValue("u-1");
    expect(await anonScopeValue()).toBeNull();
    expect(getAnonIdMock).not.toHaveBeenCalled();
  });

  it("returns the device id when anonymous", async () => {
    userIdMock.mockResolvedValue(null);
    getAnonIdMock.mockResolvedValue("dev-9");
    expect(await anonScopeValue()).toBe("dev-9");
  });
});


