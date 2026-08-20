import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ pgPool: { query: vi.fn() } }));
import { pgPool } from "@/lib/db";
import { runJobClustering, jobClusterSources } from "./job-clusters";

const queryMock = vi.mocked(pgPool.query);

beforeEach(() => vi.clearAllMocks());

describe("runJobClustering (P1)", () => {
  it("clusters duplicated jobs by dedup key and writes job_clusters", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: "Python 后端工程师", company: "星辰科技有限公司", city: "深圳", source: "boss", published_at: null, fetched_at: "2026-08-20T01:00:00Z" },
          { id: 2, title: "Python后端工程师", company: "星辰科技", city: "深圳", source: "liepin", published_at: null, fetched_at: "2026-08-19T01:00:00Z" },
          { id: 3, title: "Java 工程师", company: "某某公司", city: "上海", source: "zhilian", published_at: null, fetched_at: "2026-08-20T02:00:00Z" },
        ],
      } as never)
      .mockResolvedValue({ rows: [] } as never);

    const result = await runJobClustering(7);
    expect(result.clusters).toBe(1); // 只有前两条同键
    expect(result.merged).toBe(2);
    // 写库调用：INSERT ... job_clusters
    const insert = queryMock.mock.calls.find((c) => String(c[0]).includes("INSERT INTO job_clusters"));
    expect(insert).toBeTruthy();
    const params = insert![1] as unknown[];
    expect(params[0]).toBe("Python 后端工程师"); // canonical_title = primary
    expect(params[5]).toEqual(JSON.stringify(["boss", "liepin"])); // source_list
  });

  it("ignores single-member groups", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: "Java 工程师", company: "某某公司", city: "上海", source: "zhilian", published_at: null, fetched_at: "2026-08-20T02:00:00Z" },
        ],
      } as never)
      .mockResolvedValue({ rows: [] } as never);
    const result = await runJobClustering(7);
    expect(result.clusters).toBe(0);
    expect(queryMock.mock.calls.some((c) => String(c[0]).includes("INSERT INTO job_clusters"))).toBe(false);
  });
});

describe("jobClusterSources (P1)", () => {
  it("maps cluster sources by job id", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { job_ids: [1, 2], source_list: ["boss", "liepin"] },
      ],
    } as never);
    const map = await jobClusterSources([1, 2, 3]);
    expect(map[1]).toEqual(["boss", "liepin"]);
    expect(map[2]).toEqual(["boss", "liepin"]);
    expect(map[3]).toBeUndefined();
  });
});
