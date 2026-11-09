import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { currentUser } from "@/lib/session";
import { pgPool } from "@/lib/db";
import { GET, PUT } from "./route";

const currentUserMock = vi.mocked(currentUser);
const queryMock = vi.mocked(pgPool.query);

beforeEach(() => vi.clearAllMocks());

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/auth/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/auth/me", () => {
  it("returns the logged-in user", async () => {
    currentUserMock.mockResolvedValue({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: "u-1", username: "alice", displayName: "Alice", avatarUrl: null },
    });
    // S5-5：/api/auth/me 必须 private, no-store
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns user null when anonymous", async () => {
    currentUserMock.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ user: null });
  });
});

describe("PUT /api/auth/me", () => {
  it("requires a logged-in user", async () => {
    currentUserMock.mockResolvedValue(null);
    const res = await PUT(jsonReq({ displayName: "新昵称" }));
    expect(res.status).toBe(401);
  });

  it("updates nickname and avatar URL", async () => {
    currentUserMock.mockResolvedValue({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    } as never);
    queryMock.mockResolvedValueOnce({
      rows: [{ displayName: "阿梨", avatarUrl: "/uploads/u-1/avatar.webp" }],
    } as never);

    const res = await PUT(jsonReq({ displayName: " 阿梨 ", avatarUrl: "/uploads/u-1/avatar.webp" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: "u-1",
        username: "alice",
        displayName: "阿梨",
        avatarUrl: "/uploads/u-1/avatar.webp",
      },
    });
    const args = queryMock.mock.calls[0][1] as unknown[];
    expect(args).toContain("阿梨");
    expect(args).toContain("/uploads/u-1/avatar.webp");
  });

  it("rejects empty or overlong nicknames", async () => {
    currentUserMock.mockResolvedValue({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    } as never);
    expect((await PUT(jsonReq({ displayName: "   " }))).status).toBe(400);
    expect((await PUT(jsonReq({ displayName: "x".repeat(21) }))).status).toBe(400);
  });

  it("rejects non-upload avatar URLs", async () => {
    currentUserMock.mockResolvedValue({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    } as never);
    expect((await PUT(jsonReq({ avatarUrl: "https://example.com/a.png" }))).status).toBe(400);
    expect((await PUT(jsonReq({ avatarUrl: "/uploads/../secret" }))).status).toBe(400);
  });

  it("rejects another user's upload directory", async () => {
    currentUserMock.mockResolvedValue({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    } as never);
    expect((await PUT(jsonReq({ avatarUrl: "/uploads/u-2/avatar.webp" }))).status).toBe(400);
  });

  it("rejects nested paths and query strings", async () => {
    currentUserMock.mockResolvedValue({
      id: "u-1",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    } as never);
    expect((await PUT(jsonReq({ avatarUrl: "/uploads/u-1/a/b.webp" }))).status).toBe(400);
    expect((await PUT(jsonReq({ avatarUrl: "/uploads/u-1/avatar.webp?x=1" }))).status).toBe(400);
    expect((await PUT(jsonReq({ avatarUrl: "/uploads/u-1/" }))).status).toBe(400);
  });
});
