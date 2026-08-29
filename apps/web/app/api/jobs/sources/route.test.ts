import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ listJobSources: vi.fn(), getHostsMeta: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { listJobSources, getHostsMeta } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const sourcesMock = vi.mocked(listJobSources);
const metaMock = vi.mocked(getHostsMeta);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/sources", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns sources and meta fallback", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    sourcesMock.mockResolvedValue([]);
    metaMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toEqual([]);
    expect(body.version).toBe(0);
    expect(body.updatedAt).toBeNull();
  });
});
