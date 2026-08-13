import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("./db", () => ({
  pgPool: { query: vi.fn(), connect: vi.fn() },
}));

import { cookies, headers } from "next/headers";
import { pgPool } from "./db";
import {
  currentSessionToken,
  currentUserId,
  currentUser,
  createSession,
  destroySession,
  sessionCookieName,
} from "./session";

const cookiesMock = vi.mocked(cookies);
const headersMock = vi.mocked(headers);
const queryMock = vi.mocked(pgPool.query);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("currentSessionToken", () => {
  it("returns the cookie value when present", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "cookie-token" }),
    } as never);
    await expect(currentSessionToken()).resolves.toBe("cookie-token");
  });

  it("falls back to the Authorization Bearer header", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    headersMock.mockResolvedValue({
      get: vi.fn().mockReturnValue("Bearer header-token"),
    } as never);
    await expect(currentSessionToken()).resolves.toBe("header-token");
  });

  it("returns null when neither cookie nor bearer header exists", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    headersMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
    await expect(currentSessionToken()).resolves.toBeNull();
  });
});

describe("currentUserId", () => {
  it("returns null without a token", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);
    await expect(currentUserId()).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns the user id from an active session", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "tok" }) } as never);
    queryMock.mockResolvedValue({ rows: [{ user_id: "u-1" }] } as never);
    await expect(currentUserId()).resolves.toBe("u-1");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM sessions WHERE token = $1"),
      ["tok"]
    );
  });

  it("returns null when the session is missing/expired", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "tok" }) } as never);
    queryMock.mockResolvedValue({ rows: [] } as never);
    await expect(currentUserId()).resolves.toBeNull();
  });
});

describe("currentUser", () => {
  it("maps the joined session row", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "tok" }) } as never);
    queryMock.mockResolvedValue({
      rows: [{ id: "u-1", username: "alice", displayName: "Alice" }],
    } as never);
    await expect(currentUser()).resolves.toEqual({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
    });
  });
});

describe("createSession", () => {
  it("inserts a random token with a 30-day expiry", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const before = Date.now();
    const { token, expiresAt } = await createSession("u-1");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const ttlMs = expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(29 * 24 * 3600 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(30 * 24 * 3600 * 1000 + 1000);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions"),
      [token, "u-1", expiresAt]
    );
  });
});

describe("destroySession", () => {
  it("deletes the session row", async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    await destroySession("tok");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM sessions WHERE token = $1"),
      ["tok"]
    );
  });
});

describe("sessionCookieName", () => {
  it("is the expected cookie name", () => {
    expect(sessionCookieName).toBe("lwb_session");
  });
});
