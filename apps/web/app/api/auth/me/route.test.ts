import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));
import { currentUser } from "@/lib/session";
import { GET } from "./route";

const currentUserMock = vi.mocked(currentUser);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/auth/me", () => {
  it("returns the logged-in user", async () => {
    currentUserMock.mockResolvedValue({ id: "u-1", username: "alice", displayName: "Alice" } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: "u-1", username: "alice", displayName: "Alice" },
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
