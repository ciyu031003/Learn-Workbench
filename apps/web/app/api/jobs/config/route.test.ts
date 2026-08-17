import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/jobs", () => ({
  getCrawlerConfig: vi.fn(),
  saveCrawlerConfig: vi.fn(),
}));

import { currentUserId } from "@/lib/session";
import { getCrawlerConfig, saveCrawlerConfig } from "@/lib/jobs";
import { defaultCrawlerConfig } from "@learn-workbench/shared";
import { GET, PUT } from "./route";

const currentUserIdMock = vi.mocked(currentUserId);
const getConfigMock = vi.mocked(getCrawlerConfig);
const saveConfigMock = vi.mocked(saveCrawlerConfig);

beforeEach(() => {
  vi.clearAllMocks();
  currentUserIdMock.mockResolvedValue("u-1");
  getConfigMock.mockResolvedValue(defaultCrawlerConfig);
  saveConfigMock.mockResolvedValue();
});

describe("jobs config", () => {
  it("GET returns 401 when not logged in", async () => {
    currentUserIdMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns the user crawler config", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).config).toEqual(defaultCrawlerConfig);
    expect(getConfigMock).toHaveBeenCalledWith("u-1");
  });

  it("PUT rejects invalid config", async () => {
    const res = await PUT(new Request("http://localhost/api/jobs/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { keywords: [], platforms: ["not-a-source"], scheduleTime: "08:00" } }),
    }));
    expect(res.status).toBe(400);
    expect(saveConfigMock).not.toHaveBeenCalled();
  });

  it("PUT saves a valid config per user", async () => {
    const cfg = { ...defaultCrawlerConfig, keywords: ["网络安全"], cities: ["上海"] };
    const res = await PUT(new Request("http://localhost/api/jobs/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: cfg }),
    }));
    expect(res.status).toBe(200);
    expect(saveConfigMock).toHaveBeenCalledWith("u-1", expect.objectContaining({ keywords: ["网络安全"] }));
  });
});
