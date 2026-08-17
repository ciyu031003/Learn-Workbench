import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({ queryJobs: vi.fn() }));

import { currentUserId } from "@/lib/session";
import { queryJobs } from "@/lib/jobs";
import { GET } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const queryJobsMock = vi.mocked(queryJobs);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
  queryJobsMock.mockResolvedValue({ jobs: [], total: 0 });
});

describe("GET /api/jobs", () => {
  it("passes query filters and returns jobs", async () => {
    queryJobsMock.mockResolvedValue({
      jobs: [
        {
          id: 1, source: "lagou", sourceJobId: "l1", title: "前端工程师", company: "星辰科技",
          city: "上海", district: "徐汇", salaryMin: 15, salaryMax: 25, salaryText: "15-25K",
          experience: "1-3年", education: "本科", tags: ["React"], description: "d",
          requirements: "r", companyInfo: "c", url: "https://x", logoUrl: "",
          publishedAt: null, fetchedAt: "2026-08-17T00:00:00Z", isNew: true, isFav: false,
        },
      ],
      total: 1,
    });
    const res = await GET(new Request("http://localhost/api/jobs?q=前端&city=上海&platforms=lagou,job51&sort=salary&page=2&pageSize=10"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.page).toBe(2);
    expect(queryJobsMock).toHaveBeenCalledWith(expect.objectContaining({
      q: "前端",
      city: "上海",
      platforms: ["lagou", "job51"],
      sort: "salary",
      page: 2,
      pageSize: 10,
      userId: "u-1",
    }));
  });

  it("clamps page/pageSize and defaults sort", async () => {
    await GET(new Request("http://localhost/api/jobs?page=0&pageSize=9999"));
    expect(queryJobsMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 60, sort: "new" }));
  });
});
