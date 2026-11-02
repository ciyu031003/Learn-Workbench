import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/background/bing", () => ({ fetchBingWallpapers: vi.fn() }));

import { currentUserId } from "@/lib/session";
import { fetchBingWallpapers } from "@/lib/background/bing";
import { POST } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const fetchMock = vi.mocked(fetchBingWallpapers);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
});

describe("POST /api/background/refresh", () => {
  it("returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns ok=true and sync stats when the crawler succeeds", async () => {
    fetchMock.mockResolvedValue({ saved: 1, updated: 1, dates: ["2026-10-31", "2026-11-01"], failed: [] });
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.saved).toBe(1);
    expect(json.updated).toBe(1);
    expect(json.dates).toEqual(["2026-10-31", "2026-11-01"]);
    expect(fetchMock).toHaveBeenCalledWith({ days: 2 });
  });

  it("returns ok=false when some dates failed", async () => {
    fetchMock.mockResolvedValue({ saved: 1, updated: 0, dates: ["2026-11-01"], failed: [{ date: "2026-10-31", reason: "download failed" }] });
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(false);
    expect(json.failed).toHaveLength(1);
  });

  it("returns 500 with a message when the crawler throws", async () => {
    fetchMock.mockRejectedValue(new Error("bing 不可用"));
    const res = await POST();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain("bing");
  });
});
