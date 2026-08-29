import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ getJobDetail: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { getJobDetail } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const getJobDetailMock = vi.mocked(getJobDetail);
const ctx = { params: Promise.resolve({ id: "1" }) };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/[id]", () => {
  it("returns 400 for invalid id", async () => {
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when job does not exist", async () => {
    getJobDetailMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(404);
  });

  it("returns the job for a logged-out user", async () => {
    currentUserIdMock.mockResolvedValue(null);
    getJobDetailMock.mockResolvedValue({ id: 1, isFav: false } as never);
    const res = await GET(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).job).toMatchObject({ id: 1 });
    expect(getJobDetailMock).toHaveBeenCalledWith(1, null);
  });
});
