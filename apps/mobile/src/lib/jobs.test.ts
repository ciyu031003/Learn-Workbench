import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/config", () => ({ getApiUrl: vi.fn(() => "http://test") }));
vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: vi.fn(() => ({ token: "tok-1", apiUrl: undefined })) },
}));

import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import {
  fetchJobs,
  fetchJobDetail,
  toggleJobFavorite,
  fetchJobStats,
  fetchJobConfig,
  saveJobConfig,
  runCrawler,
  fetchJobRuns,
  fetchJobPlan,
  enrollJobGaps,
} from "./jobs";

const getApiUrlMock = vi.mocked(getApiUrl);
const getStateMock = vi.mocked(useAppStore.getState);
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getApiUrlMock.mockReturnValue("http://test");
  getStateMock.mockReturnValue({ token: "tok-1", apiUrl: undefined } as never);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.unstubAllGlobals?.();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe("buildJobListQuery / fetchJobs", () => {
  it("builds a fuller query string from every filter", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ jobs: [], total: 0, page: 1, pageSize: 20 }));
    await fetchJobs({
      q: " react ",
      city: " 上海",
      category: "前端",
      platforms: ["lagou", "boss"],
      sort: "salary",
      page: 2,
      pageSize: 10,
      salaryMin: 10,
      salaryMax: 30,
      education: ["本科"],
      experience: ["1-3年"],
      publishedWithin: "7d",
      skills: ["react", "ts"],
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      "http://test/api/jobs?" +
        "q=" + encodeURIComponent("react") +
        "&city=" + encodeURIComponent("上海") +
        "&category=" + encodeURIComponent("前端") +
        "&platforms=lagou%2Cboss" +
        "&sort=salary&page=2&pageSize=10&salaryMin=10&salaryMax=30" +
        "&education=" + encodeURIComponent("本科") +
        "&experience=" + encodeURIComponent("1-3年") +
        "&publishedWithin=7d&skills=react%2Cts&includeSources=1"
    );
  });

  it("builds a plain path when there are no filters", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ jobs: [], total: 0, page: 1, pageSize: 20 }));
    await fetchJobs();
    expect((fetchMock.mock.calls[0][0] as string)).toBe("http://test/api/jobs?includeSources=1");
  });
});

describe("apiRequest", () => {
  it("adds an Authorization header when a token exists", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    getStateMock.mockReturnValue({ token: "abc", apiUrl: undefined } as never);
    await fetchJobStats();
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer abc");
  });

  it("sends JSON for PUT with a body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, config: {} }));
    await saveJobConfig({ name: "x" } as never);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("PUT");
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("throws the server error message on a failed response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "服务器炸了" }, false, 500));
    await expect(fetchJobStats()).rejects.toThrow("服务器炸了");
  });

  it("falls back to a generic message when the error payload is malformed", async () => {
    fetchMock.mockResolvedValue(jsonResponse("{not json", false, 502));
    await expect(fetchJobStats()).rejects.toThrow("请求失败（502）");
  });

  it("throws a generic message when the server returns no error field", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 403));
    await expect(fetchJobStats()).rejects.toThrow("请求失败（403）");
  });
});

describe("job endpoints", () => {
  it("fetches job detail", async () => {
    const job = { id: 5, title: "前端" } as never;
    fetchMock.mockResolvedValue(jsonResponse({ job }));
    expect(await fetchJobDetail(5)).toEqual(job);
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/api/jobs/5");
  });

  it("toggles a favorite", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ favorited: true }));
    expect(await toggleJobFavorite(5)).toBe(true);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("fetches job stats", async () => {
    const stats = { total: 10 } as never;
    fetchMock.mockResolvedValue(jsonResponse(stats));
    expect(await fetchJobStats()).toEqual(stats);
  });

  it("fetches and saves the crawler config", async () => {
    const config = { name: "x" } as never;
    fetchMock.mockResolvedValue(jsonResponse({ config }));
    expect(await fetchJobConfig()).toEqual(config);
    expect(await saveJobConfig(config)).toEqual(config);
    const putOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(putOpts.method).toBe("PUT");
    expect(JSON.parse(putOpts.body as string)).toEqual({ config });
  });

  it("runs the crawler and returns started", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ started: false }));
    expect(await runCrawler()).toBe(false);
  });

  it("fetches job runs with an empty-array fallback", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ runs: [{ id: 1 }] }));
    expect(await fetchJobRuns()).toHaveLength(1);
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await fetchJobRuns()).toEqual([]);
  });

  it("fetches a job learning plan", async () => {
    const plan = { phases: [] } as never;
    fetchMock.mockResolvedValue(jsonResponse(plan));
    expect(await fetchJobPlan(5)).toEqual(plan);
  });

  it("enrolls job gaps and defaults created to 0", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, created: 4 }));
    const created = await enrollJobGaps([
      { skill: "react", topicId: 1, estimateHours: 2 },
      { skill: "sql", topicId: null, estimateHours: 3 },
    ]);
    expect(created).toBe(4);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.gaps).toEqual([
      { skill: "react", topicId: 1, hours: 2 },
      { skill: "sql", topicId: null, hours: 3 },
    ]);
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await enrollJobGaps([])).toBe(0);
  });
});

