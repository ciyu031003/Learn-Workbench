import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/radar", () => ({ computeRadar: vi.fn(), radarFallback: vi.fn() }));
import { currentUserId, currentSessionToken } from "@/lib/session";
import { computeRadar, radarFallback } from "@/lib/radar";
import { GET } from "./route";

const tokenMock = vi.mocked(currentSessionToken);
const userMock = vi.mocked(currentUserId);
const radarMock = vi.mocked(computeRadar);
const fallbackMock = vi.mocked(radarFallback);

const emptyResult = {
  hasProfile: false,
  profileCity: null,
  targetRole: null,
  buckets: { highMatch: [], highValue: [], urgent: [] },
  top: [],
  counts: { candidates: 0, matched: 0, favorites: 0, applications: 0 },
};

beforeEach(() => {
  vi.resetAllMocks();
  fallbackMock.mockResolvedValue(emptyResult as never);
  radarMock.mockResolvedValue(emptyResult as never);
});

describe("GET /api/jobs/radar", () => {
  it("falls back for anonymous visitors (no token) without calling currentUserId", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/radar"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("fallback");
    expect(fallbackMock).toHaveBeenCalled();
    // 关键：匿名不进入 hashToken 路径（踩坑点 34）
    expect(userMock).not.toHaveBeenCalled();
    expect(radarMock).not.toHaveBeenCalled();
  });

  it("uses batch matching for a logged-in user with a profile", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    radarMock.mockResolvedValue({ ...emptyResult, hasProfile: true, counts: { candidates: 5, matched: 3, favorites: 1, applications: 0 } } as never);
    const res = await GET(new Request("http://localhost/api/jobs/radar"));
    const body = await res.json();
    expect(body.mode).toBe("batch");
    expect(body.counts.matched).toBe(3);
  });

  it("reports fallback mode when a logged-in user has no profile", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    radarMock.mockResolvedValue({ ...emptyResult, hasProfile: false } as never);
    const res = await GET(new Request("http://localhost/api/jobs/radar"));
    const body = await res.json();
    expect(body.mode).toBe("fallback");
  });

  it("passes city and clamps limit", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    radarMock.mockResolvedValue({ ...emptyResult, hasProfile: true } as never);
    await GET(new Request("http://localhost/api/jobs/radar?city=北京&limit=999"));
    const opts = radarMock.mock.calls[0][1] as { city: string | null; limit?: number };
    expect(opts.city).toBe("北京");
    expect(opts.limit).toBe(200);
  });

  it("returns 500 on unexpected failure", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    radarMock.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(new Request("http://localhost/api/jobs/radar"));
    expect(res.status).toBe(500);
  });
});