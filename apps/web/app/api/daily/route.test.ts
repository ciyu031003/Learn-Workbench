import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn(), currentSessionToken: vi.fn() }));
vi.mock("@/lib/anon", () => ({ getAnonId: vi.fn() }));
vi.mock("@/lib/daily-os", () => ({ buildDailyOs: vi.fn() }));
import { currentUserId, currentSessionToken } from "@/lib/session";
import { getAnonId } from "@/lib/anon";
import { buildDailyOs } from "@/lib/daily-os";
import { GET } from "./route";

const tokenMock = vi.mocked(currentSessionToken);
const userMock = vi.mocked(currentUserId);
const anonMock = vi.mocked(getAnonId);
const buildMock = vi.mocked(buildDailyOs);

const req = (url = "http://localhost/api/daily") => new Request(url);

beforeEach(() => {
  vi.resetAllMocks();
  anonMock.mockResolvedValue("anon-1");
  buildMock.mockResolvedValue({ date: "2026-09-14", progress: 42 } as never);
});

describe("GET /api/daily", () => {
  it("builds the day for a logged-in user", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).progress).toBe(42);
    expect(buildMock).toHaveBeenCalledWith({ uid: "u-1", anonId: null }, expect.any(Date), null);
  });

  it("falls back to the anon scope without a token and never calls currentUserId", async () => {
    tokenMock.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(userMock).not.toHaveBeenCalled();
    expect(buildMock).toHaveBeenCalledWith({ uid: null, anonId: "anon-1" }, expect.any(Date), null);
  });

  it("passes the client-local date through ?date=（服务器 UTC 时不至于算成前一天）", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    await GET(req("http://localhost/api/daily?date=2026-09-20"));
    expect(buildMock).toHaveBeenCalledWith({ uid: "u-1", anonId: null }, expect.any(Date), "2026-09-20");
  });

  it("ignores a malformed ?date=", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    await GET(req("http://localhost/api/daily?date=2026-9-2"));
    expect(buildMock).toHaveBeenCalledWith({ uid: "u-1", anonId: null }, expect.any(Date), null);
  });

  it("returns 500 when the aggregate throws", async () => {
    tokenMock.mockResolvedValue("tok-1");
    userMock.mockResolvedValue("u-1");
    buildMock.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
