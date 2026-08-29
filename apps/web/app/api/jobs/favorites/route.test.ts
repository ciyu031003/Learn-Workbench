import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ queryJobs: vi.fn() }));
import { currentUserId } from "@/lib/session";
import { queryJobs } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const queryJobsMock = vi.mocked(queryJobs);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/jobs/favorites", () => {
  it("returns 401 when logged out", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/jobs/favorites"));
    expect(res.status).toBe(401);
  });

  it("clamps page/pageSize and queries favorites", async () => {
    currentUserIdMock.mockResolvedValue("u-1");
    queryJobsMock.mockResolvedValue({ jobs: [], total: 0 });
    const res = await GET(new Request("http://localhost/api/jobs/favorites?page=0&pageSize=999"));
    expect(res.status).toBe(200);
    expect(queryJobsMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-1", favOnly: true, page: 1, pageSize: 60 }));
    const body = await res.json();
    expect(body).toMatchObject({ page: 1, pageSize: 60 });
  });
});
